'use strict'

const xml = require('@xmpp/xml')
const StanzaError = require('@xmpp/middleware/lib/StanzaError')

// https://xmpp.org/extensions/xep-0198.html

const NS = 'urn:xmpp:sm:3'

async function enable(entity) {
  const response = await entity.sendReceive(
    xml('enable', {xmlns: NS, resume: 'true'})
  )

  if (!response.is('enabled')) {
    throw StanzaError.fromElement(response)
  }

  return response
}

async function resume(entity, h, previd) {
  const response = await entity.sendReceive(
    xml('resume', {xmlns: NS, h, previd})
  )

  if (!response.is('resumed')) {
    throw StanzaError.fromElement(response)
  }

  return response
}

module.exports = function({streamFeatures, entity}) {
  let outbound = 0
  let inbound = 0
  let enabled = false
  let SM_ID = ''
  let max = 0

  const stanzas = new Set()

  entity.on('online', () => {
    outbound = 0
    inbound = 0
    enabled = false
  })

  entity.on('send', element => {
    if (!enabled) return
    if (['presence', 'message', 'iq'].includes(element.name)) {
      stanzas.add(element)
      entity.send(xml('r', {xmlns: NS}))
    }
  })

  entity.on('element', element => {
    if (['presence', 'message', 'iq'].includes(element.name)) {
      inbound += 1
      // > When an <r/> element ("request") is received, the recipient MUST acknowledge it by sending an <a/> element to the sender containing a value of 'h' that is equal to the number of stanzas handled by the recipient of the <r/> element.
    } else if (element.is('r', NS)) {
      entity.send(xml('a', {xmlns: NS, h: inbound}))
    } else if (element.is('a', NS)) {
      // > When a party receives an <a/> element, it SHOULD keep a record of the 'h' value returned as the sequence number of the last handled outbound stanza for the current stream (and discard the previous value).
      outbound = element.attrs.h
    }
  })

  streamFeatures.use('sm', NS, async (context, next) => {
    // Resuming
    if (SM_ID) {
      try {
        const response = await resume(entity, inbound, SM_ID)
        console.log(response)
        return
      } catch (err) {
        SM_ID = ''
        enabled = false
      }
    }

    // Enabling

    // Resource binding first
    await next()

    const promiseEnable = enable(entity)

    // > The counter for an entity's own sent stanzas is set to zero and started after sending either <enable/> or <enabled/>.
    outbound = 0

    const response = await promiseEnable
    inbound = 0
    enabled = true
    SM_ID = response.attrs.id
    max = response.attrs.max
    entity.send(xml('r', {xmlns: NS}))
  })
}
