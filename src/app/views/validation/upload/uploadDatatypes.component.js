const template = require('./uploadDatatypes.html');

class DataTypesController {
  $onInit() {
    this.dataTypes = {};
    this.touched = false;
    this.dataTypeSelected = false;
  }

  $onChanges(changesObj) {
    if (this.availableTypes && 'availableTypes' in changesObj) {
      if (this.availableTypes.length === 1) {
        this.dataTypes[this.availableTypes[0].name] = true;
        this.handleChange();
      }
    }
  }

  handleChange() {
    this.dataTypeSelected = Object.values(this.dataTypes).some(v => v);
    this.touched = true;
    this.onUpdate({
      dataTypes: this.dataTypes,
    });
  }
}

export default {
  template,
  controller: DataTypesController,
  bindings: {
    availableTypes: '<',
    onUpdate: '&',
  },
};
