const bcrypt = require('bcrypt')
const LocalStrategy = require('passport-local').Strategy;

function initialize(passport, getUserByEmail) {
    passport.use(
        new LocalStrategy({usernameField: 'email'}, async (email, password, done) => {
            // Look up user in database
            const user = await getUserByEmail(email);

            if (user == null) {
                return done(null, false, {message: 'No user with that email'});
            }

            // Compare passwords
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return done(null, false, {message: 'Password incorrect'});
            }

            return done(null, user);
        })
    );

    passport.serializeUser((user, done) => done(null, user.email));
    passport.deserializeUser((email, done) => {
        getUserByEmail(email)
            .then(user => {
                if (user) {
                    user.id = user.ID;  // add the id property to the user object
                    done(null, user);
                } else {
                    done(null, false);
                }
            })
            .catch(error => {
                done(error, false);
            });
    });

}

module.exports = initialize;