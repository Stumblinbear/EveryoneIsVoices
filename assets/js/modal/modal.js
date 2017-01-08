var JohnCena = (function() {
  'use strict';

  // A set of utility functions and polyfills.
  var util = {
    // Deep clone an object
    clone: function(obj) {
      var copy;
      if(null == obj || "object" != typeof obj) return obj;
      if(obj instanceof Array) {
        copy = [];
        for(var i = 0, len = obj.length; i < len; i++)
          copy[i] = util.clone(obj[i]);
        return copy;
      }else if(obj instanceof Object) {
        copy = {};
        for(var prop in obj)
          if(obj.hasOwnProperty(prop)) copy[prop] = util.clone(obj[prop]);
        return copy;
      }
    },

    // Run a function for each element in an object
    each: function(obj, func) {
      var keys = Object.keys(obj);
      for(var i in keys)
        func(i, keys[i], obj[keys[i]])
    },

    // Polyfill for click events
    onClick: function(elem, func) {
      if(elem.addEventListener)
        elem.addEventListener("click", func, false);
      else
        elem.attachEvent('onclick', func);
    },

    // Merge two objects. Retains values in `target` if they are not present in `source`
    isObject: function(item) { return (item && typeof item === 'object' && !Array.isArray(item) && item !== null); },
    mergeDeep: function(target, source) {
      var output = Object.assign({}, target);
      if(util.isObject(target) && util.isObject(source)) {
        Object.keys(source).forEach(key => {
          if(util.isObject(source[key])) {
            if(!(key in target))
              Object.assign(output, {[key]: source[key]});
            else
              output[key] = util.mergeDeep(target[key], source[key]);
          }else{
            Object.assign(output, {[key]: source[key]});
          }
        });
      }
      return output;
    }
  };

  var JohnCena = {
    util: util,

    // The template for modals
    modalTemplate: {
      // Which element the modal should be a child of
      entryPoint: 'body',
      id: null,
      type: null,

      // Defines if the modal can be closed by the user
      allowClose: true,

      // Holds options for generators the modal uses
      generator: { },

      // Runs when the modal is opened
      onOpen: function() { },
      // Runs when the modal is told to close
      onClose: function(success, fail) { success(); },
      // Runs after a modal is closed
      onClosed: function() { },

      // Returns if the modal is currently open
      isOpen: function() { return !!this.getModalOverlay(); },
      // Return the modal's overlay
      getModalOverlay: function() { return document.getElementById('modal-' + this.id); },
      // Returns the modal html object
      getModal: function() { return document.getElementById('modal-' + this.id).firstElementChild; },

      close: function() { JohnCena.close(this); },
      open: function() { return JohnCena.open(this) }
    },

    // Holds all generators that will be used to create the modal
    generators: { },
    // Registers a new modal generator
    newGenerator: function(id, generator) {
      if(this.generators[id] !== undefined) throw 'A generator by that id already exists.';
      this.generators[id] = generator;
      if(generator.options)
        JohnCena.modalTemplate.generator[id] = util.clone(generator.options);
    },

    // Generate a new template function
    newTemplate: function(strings, ...keys) {
      return (function(...values) {
        var dict = values[values.length - 1] || {};
        var result = [strings[0]];
        keys.forEach(function(key, i) {
          var value = Number.isInteger(key) ? values[key] : dict[key];
          result.push(value, strings[i + 1]);
        });
        return result.join('');
      });
    },

    // Create a new modal
    new: function(options) {
      var newModal = util.clone(JohnCena.modalTemplate);

      // Generate a random id for the modal
      newModal.id = Math.round(Math.random() * 100000000);

      // Proxy the `loading` functions
      newModal.loading = {
        is: function() { return JohnCena.loading.is(newModal); },
        toggle: function() { JohnCena.loading.toggle(newModal); },
        set: function(callback) { JohnCena.loading.set(newModal, callback); },
        unset: function(callback) { JohnCena.loading.unset(newModal, callback); }
      };

      // For each generator defined in `options`, merge the generator's default
      // options and the user defined options
      util.each(options, function(i, key, option) {
        // If the `key` is not a valid generator, throw it in the `main` generator
        // Because reasons.
        if(newModal.generator[key] === undefined) {
          if(newModal[key] !== undefined) newModal[key] = option;
          else newModal.generator['main'][key] = option;
        }else
          newModal.generator[key] = util.mergeDeep(newModal.generator[key], option);
      });

      return newModal;
    },

    loading: {
      // Returns true if the modal is currently in a state of loading
      is: function(modal) { return !!document.getElementById('modal-' + modal.id + '-ajax'); },
      // Toggle a modal's loading state
      toggle: function(modal) {
        if(!this.is(modal)) this.set(modal);
        else this.unset(modal);
      },
      // Set a modal to an active loading state
      set: function(modal, callback) {
        if(this.is(modal)) { if(callback) callback(); return; }
        var m = modal.getModal();
        m.innerHTML = JohnCena.html.loading.dim({inner: JohnCena.html.loading.spinner}) + m.innerHTML;
        if(callback) setTimeout(callback, 1000);
      },
      // Unset a modal's loading state
      unset: function(modal, callback) {
        if(!this.is(modal)) { if(callback) callback(); return; }
        var a = document.getElementById('modal-' + modal.id + '-ajax');
        a.className += ' fade';
        // Delete the loading div after the animation completes
        setTimeout(function() {
          a.parentElement.removeChild(a);
          if(callback) callback();
        }, 1000);
      }
    },

    // Function to run to open a modal
    open: (function() {
      // Figures out the entry point for the modal
      var getEntryPoint = function(modal) {
        if(modal.entryPoint == null || modal.entryPoint == 'body')
          return document.body;
        else
          return document.getElementById(modal.entryPoint);
      };

      // Create the modal html using defined generators
      var createModal = function(modal) {
        var inner = '';
        // If the modal is allowed to close, add the `x` button
        if(modal.allowClose) inner += JohnCena.html.close({id: modal.id});

        // For each defined generator, run its body function
        util.each(JohnCena.generators, function(i, key, addition) {
          if(!addition.body) return;
          var str = addition.body(addition.html, modal, modal.generator[key]);
          if(str && str != '') inner += str;
        });

        // For each defined generator, run its footer function
        var footer = '';
        util.each(JohnCena.generators, function(i, key, addition) {
          if(!addition.footer) return;
          var str = addition.footer(addition.html, modal, modal.generator[key]);
          if(str && str != '')
            footer += str;
        });
        if(footer != '') inner += JohnCena.html.footer({inner: footer});

        return {
            obj: modal,
            html: JohnCena.html.modal({
              id: modal.id,
              inner: inner
            })
          };
      };

      // Return the promise
      var createPromise = function(modal) {
        return new Promise(function(resolve, reject) {
          // Run the final `completed` function in each defined generator
          util.each(JohnCena.generators, function(i, key, addition) {
            if(!addition.completed) return;
            addition.completed(modal, modal.generator[key], {resolve: resolve, reject: reject});
          });

          // If the modal is allowed to close
          if(modal.allowClose) {
            var overlay = modal.getModalOverlay();
            // If the user clicked the close button
            util.onClick(document.getElementById('modal-close-' + modal.id), function() {
              modal.onClose(function(data) {
                modal.close();
                resolve({action: 'closed', reason: 'close', data: data});
              }, function() {
                modal.close();
                reject({action: 'closed', reason: 'close'});
              });
            });
            // If the user clicked the outside overlay
            util.onClick(overlay, function(event) {
              if(overlay != event.target) return;
              modal.onClose(function() {
                modal.close();
                reject({action: 'closed', reason: 'overlay'});
              });
            });
          }

          // Finally, run the `onOpen` function
          modal.onOpen();
        });
      };

      return function(modal) {
        if(modal.isOpen()) throw 'Modal is already open.';
        // Create the modal html
        var newModal = createModal(modal);
        // Insert he modal into the DOM
        getEntryPoint(modal).innerHTML += newModal.html;
        // Return a promise
        return createPromise(newModal.obj);
      };
    })(),

    // Function to run to close a modal
    close: function(modal) {
      if(!modal.isOpen()) throw 'Modal is not open.';
      modal.getModalOverlay().className += ' close';
      // Delete the modal after the animation finishes
      setTimeout(function() {
        var overlay = modal.getModalOverlay();
        overlay.parentElement.removeChild(overlay);
        modal.onClosed();
      }, 500);
    }
  };

  // Required html templates for the modal
  JohnCena.html = {
    modal: JohnCena.newTemplate`<div id="modal-${'id'}" class="modal-overlay"><div class="modal">${'inner'}</div></div>`,
    close: JohnCena.newTemplate`<div id="modal-close-${'id'}" class="close">x</div>`,
    footer: JohnCena.newTemplate`<footer>${'inner'}</footer>`,
    loading: {
      dim: JohnCena.newTemplate`<div id="modal-${'id'}-ajax" class="ajax">${'inner'}</div>`,
      spinner: `<div class="loading"><div class="spinner"><div class="mask"><div class="maskedCircle"></div></div></div></div>`
    }
  };

  return JohnCena;
})();

// Main generator
JohnCena.newGenerator('main', {
  html: {
    title: JohnCena.newTemplate`<div class="title">${'text'}${'lead'}</div>`,
    lead: JohnCena.newTemplate`<div class="lead">${'text'}</div>`,
    body: JohnCena.newTemplate`<p>${'text'}</p>`
  },

  options: {
    title: '',
    lead: '',
    text: '',
    footer: ''
  },

  body: function(html, modal, options) {
    var ret = '';
    if(options.title || options.lead)
      ret += html.title({text: options.title, lead: (options.lead ? html.lead({text: options.lead}) : '')});
    if(options.text)
      ret += html.body({text: options.text});
    return ret;
  },

  footer: function(html, modal, options) {
    if(options.footer)
      return options.footer;
  }
});
