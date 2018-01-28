const pdf = require('pdf-fill-form');
const rand = require('random-int');
const util = require('util');
const path = require('path');
const fs = require('fs');

const WRITE_OPTIONS = {'save': 'pdf', 'cores': 4 };
const TARGET_DIRECTORY = path.join(__dirname, '../../../published');

const supportedForms = [
  "i589",
];

class State {
  constructor({ key, context, placeholder, question, type, options, field, final = false, initial = false }) {
    // A unique key that identifies this state.
    this.key = key;

    // A set of rules, which, when given the current (accumulated)
    // state of the form, produces the key of the next state to
    // transition to.
    this.rules = [];

    // A string giving context for the question.
    this.context = context;

    // A string giving a placeholder (example) for the question.
    this.placeholder = placeholder;

    // An associated question.
    this.question = question;

    // Is this a terminal state.
    this.final = final;

    // Is this the initial state.
    this.initial = initial;

    // Available options, for a 'multi' state.
    this.options = options;

    // An associated type of question.
    if (!['STRING', 'BOOLEAN', 'NUMERIC', 'MULTI', 'NONE'].includes(type)) {
      throw Error('Invalid type provided.');
    }
    this.type = type;

    // A field to fill with the associated state.
    this.field = field;
  }

  transition(destination, predicate) {
    this.rules.push((state) => {
      if (predicate(state)) {
        return destination;
      }

      return null;
    });

    return this;
  }

  ifTrue(destination) {
    this.transition(destination, (state) => {
      if (state[this.field]) {
        return true;
      }

      return false;
    });

    return this;
  }

  ifFalse(destination) {
    this.transition(destination, (state) => {
      if (!state[this.field]) {
        return true;
      }

      return false;
    });

    return this;
  }

  ifGreaterThanOrEqualTo(threshold, destination) {
    this.transition(destination, (state) => {
      if (state[this.field] >= threshold) {
        return true;
      }

      return false;
    });

    return this;
  }

  ifLessThanOrEqualTo(threshold, destination) {
    this.transition(destination, (state) => {
      if (state[this.field] <= threshold) {
        return true;
      }

      return false;
    });

    return this;
  }

  ifEqualTo(threshold, destination) {
    this.transition(destination, (state) => {
      if (state[this.field] == threshold) {
        return true;
      }

      return false;
    });

    return this;
  }

  goTo(destination) {
    this.transition(destination, () => true);
    return this;
  }
}

class Form {
  constructor() {
    // A base class constructor for a new form.
    this.states = []
  }

  fields() {
    // Returns the fields contained in the pdf.
    return pdf.readSync(this.form);
  }

  write(state, callback) {
    // Writes the current state of the form to a file.
    // Accepts fields to write to the form, and a callback.

    const fields = this.mapStateToFields(state);

    const filename = this.generateFileToWrite();

    // We've created a temporary file, now write the filled form to it.
    pdf.write(this.form, fields, WRITE_OPTIONS).then(
      (result) => {

        // We've prepared data to be written to the filled form.
        fs.writeFile(path.join(TARGET_DIRECTORY, filename), result, (err) => {
          if (err) {
            return callback(err);
          }

          // We've successfully filled the form out.
          callback(null, filename);
        });
      },
      (err) => {
        return callback(err);
      },
    );
  }

  mapStateToFields(state) {
    return {}
  }

  generateFileToWrite() {
    let isCollision = true;
    let fileName = "";
    while (isCollision) {
      fileName = util.format("form%d.pdf", rand(1, 64000))

      if (!fs.existsSync(path.join(TARGET_DIRECTORY, fileName))) {
        isCollision = false;
      }
    }

    return fileName;
  }

  transition(current, state) {
    // Returns the next state to transition to.
    const currentState = this.states.find(element => element.key == current);

    if (!currentState) {
      // An unknown state.
      return null;
    }

    for (let rule of currentState.rules) {
      const nextState = rule(state);
      if (nextState) {
        // We've found the transition.

        if (!this.states.find(element => element.key == nextState)) {
          // We have an invalid transition.
          return null;
        }

        return nextState;
      }
    }

    // We aren't transitioning.
    // XXX: It's unclear whether this should error, or return
    return currentState;
  }
}

module.exports = {
  Form,
  State,
  supportedForms,
}
