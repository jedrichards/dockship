var Docker = require('dockerode'),
    spawn = require('child_process').spawn;

var Dockship = function(opts) {

  opts = opts || {};

  this.docker = new Docker({
    host: opts.host || 'http://127.0.0.1',
    port: opts.port || 4243
  });

}

// Image stuff

Dockship.prototype.listApps = function(appName, cb) {
  this.docker.listImages(function(err, data) {
    if(err) return cb(err);
    cb(null, data.map(function(app) {
      if(! appName || appName === app.RepoTags[0]) {
        return {
          name: app.RepoTags,
          id: app.Id
        };
      }
    }).clean());
  });
};

Dockship.prototype.deleteApp = function(appId, cb) {
  var app = this.docker.getImage(appId);
  app.remove(cb);
};

Dockship.prototype.deployApp = function(appName, cb) {
  var tar_stream = spawn('tar', ['cv', './']);
  tar_stream.stderr.pipe(process.stderr);
  this.docker.buildImage(tar_stream.stdout, {t: appName}, cb);
};


// Container stuff

Dockship.prototype.listAppInstances = function(cb) {
  this.docker.listContainers({all: false}, cb);
};

Dockship.prototype.getAppIds = function(appName, cb) {
  this.listAppInstances(function(err, data) {
    if(err) return cb(err);
    cb(null, data.map(function(container) {
      return(container.Id);
    }).clean());
  });
};

Dockship.prototype.findAppIds = function(appName, cb) {
  this.listAppInstances(function(err, data) {
    if(err) return cb(err);
    cb(null, data.map(function(container) {
      if(container.Image === appName || appName === '--all') {
        return(container.Id);
      }
    }).clean());
  });
};

Dockship.prototype.startApp = function(appId, cb) {
  this.docker.createContainer({
    Image: appId
  }, function(err, container) {
    if(err) return cb(err);

    container.inspect(function(err, containerDetails) {
      if(err) return cb(err);

      var cfg = {
        PortBindings: {}
      }

      var exposedPorts = containerDetails.Config.ExposedPorts;
      for(var i in exposedPorts) {
        cfg.PortBindings[i] = [
          {
            HostIp: '0.0.0.0',
            HostPort: i.split('/')[0]
          }
        ]
      }

      container.start(cfg, function(err) {
        if(err) return cb(err);
        cb(null, container.id);
      });

    });

  });
};

Dockship.prototype.stopApp = function(appId, cb) {
  var container = this.docker.getContainer(appId);
  container.stop(function(err) {
    if(err) return cb(err);
    container.remove(cb);
  });
};

module.exports = Dockship;

// Helpers

Array.prototype.clean = function(deleteValue) {
  for (var i = 0; i < this.length; i++) {
    if (this[i] === deleteValue) {
      this.splice(i, 1);
      i--;
    }
  }
  return this;
};