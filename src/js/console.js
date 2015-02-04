/*
 * Copyright (C) 2012-2013 InSeven Limited.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

(function($) {

  App.Console = function(device, gameBoy, events, store) {
    this.init(device, gameBoy, events, store);
  };
  
  App.Console.State = {
    VISIBLE: 0,
    HIDDEN:  1,
  };
  
  App.Console.Orientation = {
    PORTRAIT:  0,
    LANDSCAPE: 1,
  };
  
  App.Console.Dimensions = {
  
    SHOW_TOP:            0,
    HIDE_TOP_PORTRAIT:  -504,
    HIDE_TOP_LANDSCAPE: -256,
    
    DEVICE_WIDTH: 320,

    TITLEBAR_HEIGHT: 42
    
  };

  App.Console.SHAKE_THRESHOLD = 18;
  App.Console.SHAKE_TIMEOUT_MS = 800;

  jQuery.extend(
    App.Console.prototype, {
      
      init: function(device, gameBoy, events, store) {
        var self = this;
        
        self.logging = new App.Logging(App.Logging.Level.WARNING);
        self.device = device;
        self.gameBoy = gameBoy;
        self.events = events;
        self.store = store;
        self.state = App.Console.State.VISIBLE;
        self.element = $('#screen-console');
        self.displayIdle = $('#LCD-idle');
        self.displayLoading = $('#LCD-loading');
        self.colors = ["grape", "cherry", "teal", "lime", "yellow"];
        self.color = "teal";

        window.tracker.track('console');

        self.gameBoy.onStateChange(function(state) {
          if (state === App.GameBoy.State.IDLE) {
            self.displayIdle.show();
            self.displayLoading.hide();
          } else if (state === App.GameBoy.State.LOADING) {
            self.displayLoading.show();
            self.displayIdle.hide();
          } else if (state === App.GameBoy.State.RUNNING) {
            self.displayLoading.hide();
            self.displayIdle.hide();
          } else if (state === App.GameBoy.State.ERROR) {
          }
        });

        mapping = {
          13: Gameboy.Key.START,
          16: Gameboy.Key.SELECT,
          37: Gameboy.Key.LEFT,
          38: Gameboy.Key.UP,
          39: Gameboy.Key.RIGHT,
          40: Gameboy.Key.DOWN,
          88: Gameboy.Key.A,
          90: Gameboy.Key.B
        };

        // Keyboard events.
        $(document).keydown(function(event) {
          keycode = mapping[event.which];
          if (keycode) {
            self.gameBoy.keyDown(keycode);
            event.preventDefault();
          }
        });
        $(document).keyup(function(event) {
          keycode = mapping[event.which];
          if (keycode) {
            self.gameBoy.keyUp(keycode);
            event.preventDefault();
          }
        });

        // D-Pad.
        self.pad = new App.Controls.Pad('#control-dpad', {
          'touchDownLeft'  : function() { self.gameBoy.keyDown(Gameboy.Key.LEFT); },
          'touchUpLeft'    : function() { self.gameBoy.keyUp(Gameboy.Key.LEFT); },
          'touchDownRight' : function() { self.gameBoy.keyDown(Gameboy.Key.RIGHT); },
          'touchUpRight'   : function() { self.gameBoy.keyUp(Gameboy.Key.RIGHT); },
          'touchDownUp'    : function() { self.gameBoy.keyDown(Gameboy.Key.UP); },
          'touchUpUp'      : function() { self.gameBoy.keyUp(Gameboy.Key.UP); },
          'touchDownDown'  : function() { self.gameBoy.keyDown(Gameboy.Key.DOWN); },
          'touchUpDown'    : function() { self.gameBoy.keyUp(Gameboy.Key.DOWN); }
        });
        
        // A.
        self.a = new App.Controls.Button('#control-a', { 'touchDown' : function() {
          self.gameBoy.keyDown(Gameboy.Key.A);
        }, 'touchUp': function() {
          self.gameBoy.keyUp(Gameboy.Key.A);
        }});

        // B.
        self.b = new App.Controls.Button('#control-b', { 'touchDown' : function() {
          self.gameBoy.keyDown(Gameboy.Key.B);
        }, 'touchUp': function() {
          self.gameBoy.keyUp(Gameboy.Key.B);
        }});

        // Start.
        self.start = new App.Controls.Button('#control-start', { 'touchDown' : function() {
          self.gameBoy.keyDown(Gameboy.Key.START);
        }, 'touchUp': function() {
          self.gameBoy.keyUp(Gameboy.Key.START);
        }});

        // Select.
        self.select = new App.Controls.Button('#control-select', { 'touchDown' : function() {
          self.gameBoy.keyDown(Gameboy.Key.SELECT);
        }, 'touchUp': function() {
          self.gameBoy.keyUp(Gameboy.Key.SELECT);
        }});

        // Tapping the screen shows the game picker.
        self.screen = new App.Controls.Button('#display', { 'touchUp': function() {
          window.tracker.track('games');
          self.hide();
        }});

        // Dismiss button.
        self.done = new App.Controls.Button('#button-done', { 'touchUp': function() {
          self.show();
        }});

        // Color picker.
        self.picker = new App.Controls.Button('#element-color', { touchUp: function() {
          self.shuffleColor();
        }});

        // Shake to set color.
        self.restoreColor().then(function(color) {
          self.onShake(self.shuffleColor);
        });

      },

      shuffleColor: function() {
        var self = this;
        self.logging.info("Shuffle color");
        var index = Math.floor(Math.random() * (self.colors.length - 1));
        var color = self.colors[index];
        if (color == self.color) {
          color = self.colors[index + 1];
        }
        self.setColor(color);
      },

      onShake: function(callback) {
        var self = this;
        var lastShakeTime = new Date().getTime();
        window.addEventListener('devicemotion', function (e) {
          var x = e.accelerationIncludingGravity.x;
          var y = e.accelerationIncludingGravity.y;
          var z = e.accelerationIncludingGravity.z;
          var xy = Math.sqrt((x * x) + (y * y));
          var xyz = Math.sqrt((xy * xy) + (z * z));
          var now = new Date().getTime();
          var msSinceLastShake = now - lastShakeTime;
          if (msSinceLastShake > App.Console.SHAKE_TIMEOUT_MS &&
              xyz > App.Console.SHAKE_THRESHOLD) {
            self.logging.info("Shake occurred");
            callback();
            lastShakeTime = now;
          }
        }, false);
      },

      restoreColor: function() {
        var self = this;
        var deferred = new jQuery.Deferred();
        self.logging.info("Attempting to restore the previous color");
        self.store.property(App.Controller.Domain.SETTINGS, App.Store.Property.COLOR, function(color) {
          self.logging.info("Loaded previous color: " + color);
          if (color === undefined) {
            deferred.reject();
            return;
          }
          self.setColor(color);
          deferred.resolve(color);
        });
        return deferred.promise();
      },

      setColor: function(color) {
        var self = this;
        self.logging.info("Set color: " + color);
        if (color == self.color) {
          self.logging.info("Ignoring set to current color: " + color);
          return;
        }
        self.store.setProperty(App.Controller.Domain.SETTINGS, App.Store.Property.COLOR, color);
        self.element.addClass(color);
        self.element.removeClass(self.color);
        self.color = color;
      },
      
      event: function(id) {
        var self = this;
        if (id in self.events) {
          self.events[id]();
        }
      },
      
      hide: function() {
        var self = this;
        if (self.state != App.Console.State.HIDDEN) {
          self.event('willHide');
          self.state = App.Console.State.HIDDEN;
          setTimeout(function() {
            self.element.addClass("open");
            self.event('didHide');
          }, 10);
        }
      },
      
      show: function() {
        var self = this;
        if (self.state != App.Console.State.VISIBLE) {
          window.tracker.track('console');
          self.event('willShow');
          self.state = App.Console.State.VISIBLE;
          self.element.removeClass("open");
          setTimeout(function() {
            self.event('didShow');
          }, 400);
        }
      },

      setTitle: function(title)  {
        var self = this;
        self.done.setTitle(title);
      }
      
  });

})(jQuery);
