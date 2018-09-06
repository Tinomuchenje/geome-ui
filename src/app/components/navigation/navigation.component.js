const template = require('./navigation.html');

class NavigationController {
  constructor($state, ExpeditionService, $transitions) {
    'ngInject';

    this.$state = $state;
    this.$transitions = $transitions;
    this.ExpeditionService = ExpeditionService;

    // on project change, retrieve expedition data
    this.$transitions.onBefore({}, () => {
      this.ExpeditionService.getExpeditionsForUser(
        this.currentProject.projectId,
        true,
      ).then(({ data }) => {
        this.data = data;
      });
    });
  }

  // On initialization, retrieve expedition data
  $onInit() {
    this.ExpeditionService.getExpeditionsForUser(
      this.currentProject.projectId,
      true,
    ).then(({ data }) => {
      this.data = data;
    });
  }
}

export default {
  template,
  controller: NavigationController,
  bindings: {
    currentUser: '<',
    currentProject: '<',
  },
};
