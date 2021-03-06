'use strict'

const Connection = require('@xmpp/connection-tcp')
const crypto = require('crypto')
const xml = require('@xmpp/xml')

/*
 * References
 * https://xmpp.org/extensions/xep-0114.html done
 * https://xmpp.org/extensions/xep-0225.html) todo
 */

const NS = 'jabber:component:accept'

class Component extends Connection {
  socketParameters(service) {
    const params = super.socketParameters(service)
    params.port = params.port || 5347
    return params
  }

  // https://xmpp.org/extensions/xep-0114.html#example-4
  send(el) {
    if (this.jid && !el.attrs.from) {
      el.attrs.from = this.jid.toString()
    }

    if (this.domain && !el.attrs.to) {
      el.attrs.to = this.domain
    }

    return super.send(el)
  }

  // https://xmpp.org/extensions/xep-0114.html#example-3
  authenticate(id, password) {
    const hash = crypto.createHash('sha1')
    hash.update(id + password, 'binary')
    return this.sendReceive(xml('handshake', {}, hash.digest('hex'))).then(
      el => {
        if (el.name !== 'handshake') {
          throw new Error('Unexpected server response')
        }
        this._jid(this.domain)
        this._status('online', this.jid)
      }
    )
  }
}

Component.NS = NS
Component.prototype.NS = NS

module.exports = Component
