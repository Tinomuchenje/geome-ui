import angular from 'angular';
import XLSXReader from '../../utils/XLSXReader';

import StatusPolling from "./StatusPolling";
import detectBrowser from '../../utils/detectBrowser';

const defaultResults = {
  validation: {},
  error: "",
  status: "",
  uploadMessage: "",
  successMessage: "",
  showCancelButton: false,
  showOkButton: false,
  showContinueButton: false,
  showStatus: false,
  showValidationMessages: false,
  showUploadMessages: false,
  showSuccessMessages: false,
};

const getExt = (filename) => {
  const parts = filename.split('.');
  return parts[ parts.length - 1 ] || undefined;
};

class ValidationController {
  constructor($scope, $http, $window, $uibModal, DataService, Upload, ProjectConfigService, ExpeditionService, FailModalFactory, REST_ROOT, MAPBOX_TOKEN) {

    this.$scope = $scope;
    this.$http = $http;
    this.$uibModal = $uibModal;
    this.REST_ROOT = REST_ROOT;
    this.ExpeditionService = ExpeditionService;
    this.DataService = DataService;
    let latestExpeditionCode = null;
    let modalInstance = null;

    this.polling = new StatusPolling($http, REST_ROOT);
    //TODO find a better place for this
    this.polling.on('error', (err) => {
      this.results.error = err;
      this.results.showOkButton = true;
    });
    this.polling.on('status', (status) => {
      this.results.status = status;
      this.results.error = null;
    });

    this.fimsMetadata = null;
    this.verifyDataPoints = false;
    this.coordinatesVerified = false;
    this.displayResults = false;
    this.coordinatesErrorClass = null;
    this.showGenbankDownload = false;
    this.activeTab = 0;

    $http.get(`${this.REST_ROOT}utils/getNAAN`).then(({ data }) => this.NAAN = data.naan);
  }

  $onInit() {
    this.results = Object.assign({}, defaultResults);

    this.checkBrowser();
  }

  checkBrowser() {
    const { browser, version } = detectBrowser();

    if (browser === "Explorer" && version <= 9) {
      angular.alerts.warn(
        `NOTE: Your browser only supports the Template Generator and not the Validation Component.
         Use IE 11, or a recent version of Chrome, Firefox, or Safari to run data validation.`,
      );
    }
  }

  handleUpload(data) {
    data.projectId = this.currentProject.projectId;

    return this.validateSubmit(data)
      .then((response) => {
        if (response.data.done) {
          this.results.validation = response.data;
          this.results.showOkButton = true;
          this.results.showValidationMessages = true;
        } else if (response.data.uploadUrl) {
          if (response.data.uploadUrl) {
            this.continueUpload(response.data.uploadUrl);
          } else {
            this.results.validationMessages = response.data;
            this.results.showValidationMessages = true;
            this.results.showStatus = false;
            this.results.showContinueButton = true;
            this.results.showCancelButton = true;
            // if (!angular.equals(this.fastqMetadata, defaultFastqMetadata)) {
            //   this.showGenbankDownload = true;
            // }
          }
        } else {
          this.results.error = "Unexpected response from server. Please contact system admin.";
          this.results.showOkButton = true;
        }
      });
  }

  continueUpload() {
    this.polling.startPolling();
    this.results.showStatus = true;
    return $http.get(REST_ROOT + "validate/continue?createExpedition=" + this.newExpedition).then(
      function (response) {
        if (response.data.error) {
          this.results.error = response.data.error;
        } else if (response.data.continue) {
          this.results.uploadMessage = response.data.continue.message;
          this.results.showOkButton = false;
          this.results.showContinueButton = true;
          this.results.showCancelButton = true;
          this.results.showStatus = false;
          this.results.showUploadMessages = true;
        } else {
          this.results.successMessage = response.data.done;
          modalInstance.close();
          this.latestExpeditionCode = this.expeditionCode;
          // if (!angular.equals(this.fastqMetadata, defaultFastqMetadata)) {
          //   this.showGenbankDownload = true;
          // }
          this.resetForm();
        }

      }, function (response) {
        this.results = Object.assign({}, defaultResults);
        this.results.error = response.data.error || response.data.usrMessage || "Server Error!";
        this.results.showOkButton = true;
      })
      .finally(
        function () {
          if (this.newExpedition) {
            // getExpeditions();
          }
          this.polling.stopPolling();
        },
      );
  }

  validateSubmit(data) {
    this.results = Object.assign({}, defaultResults);
    this.showGenbankDownload = false;
    // start polling here, since firefox support for progress events doesn't seem to be very good
    // this.polling.startPolling();
    this.results.showStatus = true;
    this.openResultsModal();
    return this.DataService.validate(data)
      .catch((response) => {
        this.results.error = response.data.usrMessage || "Server Error!";
        this.results.showOkButton = true;
        return response;
      })
      .finally(() => this.polling.stopPolling());

  }

  // TODO should this be moved to the validate component?
  validate() {
    const data = {
      projectId: this.currentProject.projectId,
      expeditionCode: this.expeditionCode,
      upload: false,
    };

    if ([ 'xlsx', 'xls' ].includes(getExt(this.fimsMetadata.name))) {
      data.workbooks = [ this.fimsMetadata ];
    } else {
      data.dataSourceMetadata = [ {
        dataType: 'TABULAR',
        filename: this.fimsMetadata.name,
        metadata: {
          sheetName: 'Samples' //TODO this needs to be dynamic, depending on the entity being validated
        },
      } ];
      data.dataSourceFiles = [ this.fimsMetadata ];
    }

    this.validateSubmit(data)
      .then((response) => {
        this.results.validation = response.data;
        this.modalInstance.close();
      });
  }

  openResultsModal() {
    this.modalInstance = this.$uibModal.open({
      component: 'fimsResultsModal',
      size: 'md',
      windowClass: 'app-modal-window',
      backdrop: 'static',
      resolve: {
        onContinue: () => () => {
          this.continueUpload();
          this.results.showContinueButton = false;
          this.results.showCancelButton = false;
          this.results.showValidationMessages = false;
        },
        results: () => this.results,
      },
    });

    this.modalInstance.result
      .finally(() => {
          if (!this.results.error) {
            this.activeTab = 2; // index 2 is the results tab
          }
          this.displayResults = true;
          this.results.showStatus = false;
          this.results.showValidationMessages = true;
          this.results.showSuccessMessages = true;
          this.results.showUploadMessages = false;
        })

  }

  //TODO move this to uploads?
  resetForm() {
    this.fimsMetadata = null;
    this.fastaFiles = [];
    this.fastaData = [];
    this.fastaCnt = [ 0 ];
    this.fastqFilenames = null;
    // angular.copy(defaultFastqMetadata, this.fastqMetadata);
    this.expeditionCode = null;
    this.verifyDataPoints = false;
    this.coordinatesVerified = false;
    this.$scope.$broadcast('show-errors-reset');
  }

  fimsMetadataChange(fimsMetadata) {
    this.fimsMetadata = fimsMetadata;
    // Clear the results
    this.results = Object.assign({}, defaultResults);

    if (this.fimsMetadata) {
      // Check NAAN
      this.parseSpreadsheet("~naan=[0-9]+~", "Instructions")
        .then((naan) => {
          if (this.NAAN && naan && naan > 0) {
            if (naan !== this.NAAN) {
              const message =
                `Spreadsheet appears to have been created using a different FIMS/BCID system. 
                 Spreadsheet says NAAN = ${naan} 
                 System says NAAN = ${this.NAAN} 
                 Proceed only if you are SURE that this spreadsheet is being called. 
                 Otherwise, re-load the proper FIMS system or re-generate your spreadsheet template.`;
              angular.alerts.error(message);
            }
          }
        });

      // generateMap('map', this.currentProject.projectId, this.fimsMetadata, MAPBOX_TOKEN).then(
      //   function () {
      //     this.verifyDataPoints = true;
      //   }, function () {
      //     this.verifyDataPoints = false;
      //   }).always(function () {
      //   // this is a hack since we are using jQuery for generateMap
      //   this.$scope.$apply();
      // });
    } else {
      this.verifyDataPoints = false;
      this.coordinatesVerified = false;
    }
  }

  parseSpreadsheet(regExpression, sheetName) {
    const splitFileName = this.fimsMetadata.name.split('.');

    if (XLSXReader.exts.includes(splitFileName[ splitFileName.length - 1 ])) {
      return new XLSXReader()
        .findCell(this.fimsMetadata, regExpression, sheetName)
        .then((match) => (match) ? match.toString().split('=')[ 1 ].slice(0, -1) : match);
    }

    return Promise.resolve();
  }
}

export default {
  template: require('./validation.html'),
  controller: ValidationController,
  bindings: {
    currentUser: "<",
    currentProject: "<",
    userExpeditions: '<',
  },
};
