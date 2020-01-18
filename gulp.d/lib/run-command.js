'use strict'

const PluginError = require('plugin-error')
const npmPath = require('npm-path')
const { spawn } = require('child_process')
const which = require('npm-which')(__dirname)

module.exports = (name, args, onSuccess) =>
  new Promise((resolve, reject) =>
    npmPath.get({ cwd: __dirname }, (npmPathErr, path) => {
      if (npmPathErr) reject(new PluginError('run-command', 'Could not resolve npm PATH'))
      which(name, (whichErr, command) => {
        if (whichErr) return reject(new PluginError('run-command', `Could not locate command: ${name}`))
        const env = Object.assign({}, process.env, { [npmPath.PATH]: path })
        spawn(command, args, { env, stdio: 'inherit' }).on('close', (code) => {
          if (code === 0) {
            if (onSuccess) onSuccess()
            resolve()
          } else {
            reject(new PluginError('run-command', `Command failed: ${name}`))
          }
        })
      })
    })
  )
