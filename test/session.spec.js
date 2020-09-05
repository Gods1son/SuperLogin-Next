'use strict';
const util = require('util');
const expect = require('chai').expect;
const Session = require('../lib/session').Session;
const Configure = require('../lib/config/configure').ConfigHelper;
const rimraf = util.promisify(require('rimraf'));

const testToken = {
  _id: 'colinskow',
  roles: ['admin', 'user'],
  key: 'test123',
  password: 'pass123',
  issued: Date.now(),
  expires: Date.now() + 50000
};

const config = new Configure({
  session: {
    adapter: 'memory'
  }
});

const fileConfig = new Configure({
  session: {
    adapter: 'file',
    file: {
      sessionsRoot: '.session'
    }
  }
});

describe('Session', function () {
  return runTest(config, 'Memory adapter')
    .finally(function () {
      return runTest(fileConfig, 'File adapter');
    })
    .finally(function () {
      config.setItem('session.adapter', 'redis');
      return runTest(config, 'Redis adapter');
    })
    .finally(function () {
      return rimraf('./.session');
    });
});

function runTest(config, adapter) {
  const session = new Session(config);
  let previous;

  return new Promise(function (resolve, reject) {
    describe(adapter, function () {
      it('should store a token', function (done) {
        previous = session
          .storeToken(testToken)
          .then(function () {
            return session.confirmToken(testToken.key, testToken.password);
          })
          .then(function (result) {
            console.log('stored token');
            expect(result.key).to.equal(testToken.key);
            done();
          })
          .catch(function (err) {
            done(err);
          });
      });

      it('should confirm a key and return the full token if valid', function (done) {
        previous.then(function () {
          return session
            .confirmToken(testToken.key, testToken.password)
            .then(function (result) {
              console.log('confirmed token');
              expect(result._id).to.equal('colinskow');
              done();
            })
            .catch(function (err) {
              done(err);
            });
        });
      });

      it('should reject an invalid token', function (done) {
        previous.then(function () {
          return session
            .confirmToken('faketoken', testToken.password)
            .catch(function (err) {
              console.log('rejected invalid token');
              expect(err).to.equal('invalid token');
              done();
            });
        });
      });

      it('should reject a wrong password', function (done) {
        previous.then(function () {
          return session
            .confirmToken(testToken.key, 'wrongpass')
            .catch(function (err) {
              console.log('rejected invalid token');
              expect(err).to.equal('invalid token');
              done();
            });
        });
      });

      it('should delete a token', function (done) {
        previous.then(function () {
          return session
            .deleteTokens(testToken.key)
            .then(function (result) {
              expect(result).to.equal(1);
              return session.confirmToken(testToken.key);
            })
            .then(function () {
              throw new Error('failed to delete token');
            })
            .catch(function (err) {
              console.log('deleted token');
              expect(err).to.equal('invalid token');
              session.quit();
              done();
              resolve();
            });
        });
      });
    });
  });
}
