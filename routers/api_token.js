const express = require('express')
const fs = require('fs')

const path = require('path')
const rootdir = path.join(__dirname, '../')

const jwt = require('jsonwebtoken')
const WEB_TOKEN_SECRET = fs.readFileSync(rootdir + 'jwtsecret.key', 'utf-8')

module.exports = {
    path: '/api/token',
    generate: (config, db) => {

        const router = express.Router()

        router.post('/verify', (req, res) => {
            if (!req.body.token) return res.send({"err": "missing-token"})

            // verify the token
            jwt.verify(req.body.token, WEB_TOKEN_SECRET, async(err, decoded) => {
                if (err) return res.send({"err": "invalid-token"})

                // check if it's the admin user
                if (decoded.sub === config.admin.username) {
                    let payload = { id: config.admin.username, username: config.admin.username, reference: config.admin.username, permissions: 8 }
                    if (decoded.exp - (60*60*24*7) < Date.now() / 1000) payload.refresh = true
                    return res.send(payload)
                }

                // fetch the user object
                const users = await db.query('SELECT * FROM users WHERE id = ?', [decoded.sub])
                if (users.length === 0) return res.send({"err": "invalid-token"})

                // respond
                let payload = { id: decoded.sub, username: users[0].username, reference: users[0].reference, permissions: users[0].permissions }
                if (decoded.exp - (60*60*24*7) < Date.now() / 1000) payload.refresh = true
                return res.send(payload)
            })
        })

        router.post('/refresh', (req, res) => {
            if (!req.body.token) return res.send({"err": "missing-token"})

            // verify the token
            jwt.verify(req.body.token, WEB_TOKEN_SECRET, async(err, decoded) => {
                if (err) return res.send({"err": "invalid-token"})

                // fetch the user object
                const users = await db.query('SELECT * FROM users WHERE id = ?', [decoded.sub])
                if (users.length === 0 && decoded.sub !== 'admin') return res.send({"err": "invalid-token"})

                // generate a new token
                const newtoken = jwt.sign({}, WEB_TOKEN_SECRET, { expiresIn: 60 * 60 * 24 * 14, subject: decoded.sub })
                return res.send({"token": newtoken})
            })
        })

        return router

    }
}