(function() {
  const express = require('express');
  const app = express();
  const hb = require('express-handlebars');
  const cookieParser = require('cookie-parser');
  const bodyParser = require('body-parser');
  const cookieSession = require('cookie-session');
  const dbModule = require('./db');
  const cache = require('./cache');


  app.use('/public', express.static(__dirname + "/public"));


  app.use(cookieParser());
  app.use(bodyParser.urlencoded({
    extended: false
  }));

  app.use(cookieSession({
    name: 'session',
    secret: 'Dont make sense for a bitch to be this endowed',
    maxAge: 1000 * 60 * 60 * 24 * 14
  }));


  app.engine('handlebars', hb());
  app.set('view engine', 'handlebars');

  app.get('/profile/:id', (req, res) => {
    otherId = req.params.id

    dbModule.userInfo(otherId).then((results) => {
      res.render('other-profile', {
        layout: 'main',
        otherUserInfo: results
      })
    }).catch((err)=> {
      console.log('get otherUserInfo err: ', err)
    })
  })


  app.get('/signed/:city', (req, res) => {
    dbModule.byCity(req.params.city).then((results) => {
      console.log(results);
      res.render('city', {
        layout: 'main',
        names: results,
        city: req.params.city
      })
    }).catch((err) => {
      console.log('err on get city: ');
    })
  })

  app.get('/signed', (req, res) => {
    cache.get('signers').then((results) => {
      if(results) {
        res.render('signed', {
          layout: 'main',
          names: results
        })
      } else {
        dbModule.getAllSigs().then((results) => {
          cache.setex('signers', 180, results).then(() => {
            console.log(results, JSON.stringify(results));
            res.render('signed', {
              layout: 'main',
              names: results
            })
          })
        }).catch((err) => {
          console.log('getAllSigs err: ', err)
        })
      }
    })
  })

  app.get('/edit-profile', (req, res) => {
    dbModule.userInfo(req.session.user.id).then((results) => {
      res.render('edit', {
        layout: 'main',
        userInfo: results
      });
    })
  })

  app.post('/editUser', (req, res) => {

  dbModule.updateProfile(req.body, req.session.user.id).then((results) => {
    console.log(results);
    if (req.body.password = '') {
      console.log('nothing to see here');
    } else {
      dbModule.hashPassword(req.body.password, req.session.user.id)
    }
    if (req.body.username != req.session.user.user) {
      dbModule.updateUsername(req.body, req.session.user.id);
    }
  }).catch((err) => {
    console.log('edit info err: ', err)
  })
  res.redirect('/signed')
})

  app.get('/register', (req, res) => {
    res.render('register', {
      layout: 'landing'
    });
  })

  app.post('/newUser', (req, res) => {
    if (!req.body.username || !req.body.password) {
      res.render('register', {
        layout: 'landing',
        error: true
      })
    } else {
      dbModule.newUser(req.body).then((id) => {
        dbModule.hashPassword(req.body.password, id);
        req.session.user = {
          first: req.body.first,
          last: req.body.last,
          user: req.body.username,
          id: id,
          login: true
        }
        console.log(req.session.user.id)
        res.redirect('/profile');
      }).catch((err) => {
        console.log("this is an error in the hashPass post: ", err);
      })
    }
  });

  app.post('/signPetition', (req, res) => {
    if(!req.body.signature) {
      res.render('form', {
        layout: 'main',
        error: true
      })
    } else {
      dbModule.newSign(req.body.signature, req.session.user.id).then((id) => {
        req.session.user.signed = true;
        req.session.user.signId = id;
        console.log(req.session.user);
        cache.del('signers');
        res.redirect('/thank-you');
      }).catch((err) => {
        console.log('new sign error: ', err)
      })
    }
  });

  app.get('/thank-you', (req, res) => {
    if(!req.session.user.signed) {
      res.redirect('/petition')
    } else {
      dbModule.getSig(req.session.user.signId).then((results) => {
        res.render('thanks', {
          layout: 'main',
          name: req.session.user.first,
          sig: results
        })
      }).catch((err) => {
        console.log(err);
      });
    }
  })


  app.get('/profile', (req, res) => {
    res.render('profile', {
      layout: 'landing',
      name: req.session.user.user
    })
  })

  app.post('/newProfile', (req, res) => {
    dbModule.newProfile(req.body, req.session.user.id).then((results) => {
      console.log(results);
      res.redirect('/mission');
    }).catch((err) => {
      console.log('profile fail: ', err)
    })
  })

  app.get('/petition', (req, res) => {
    res.render('form', {
      layout: 'main',
      first: req.session.user.first,
      last: req.session.user.last
    })
  });

  app.get('/login', (req, res) => {
    res.render('login', {
      layout: 'main'
    })
  })

  app.post('/login', (req, res) => {
    if (!req.body.username || !req.body.password) {

      res.render('login', {
        layout: 'main',
        error: true
      });

    } else {
      dbModule.checkUsername(req.body.username).then((results) => {
        let hash = results.hashed_pass;
        dbModule.checkPassword(req.body.password, hash).then((match) => {
          console.log(match)
          if (match == true) {
            res.redirect('/mission');
          } else {
            res.render('login', {
              layout: 'main',
              errorcheck: true
            });
          }
        })
      }).catch((err) => {
          res.render('login', {
            layout: 'main',
            erroruser: true
          });
          console.log('almost to mission page: ', err);
        })
      }
    })

  app.use((req, res, next) => {
    if (req.body.check == 'on') {
      //put more cookies if want
    }
    next();
  })

  app.get('/mission', (req, res) => {
    res.render('mission', {
      layout: 'main'
    })
  })



  app.get('/logout', (req,res) => {
    res.render('logout', {
      layout: 'main'
    })
    res.session = null;
  })


  app.listen(8080, () => {
    console.log("maoooooo")
  })

})()