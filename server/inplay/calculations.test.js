import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGraphPayload,
  getInitialValues,
  getMarketDrawAdjustment,
  linearDecayWithMarketDrawAdjust,
  linearDecayWithMarketDrawAdjustGls,
} from './calculations.js'

test('SUP market draw adjustment mirrors the source formula', () => {
  assert.equal(getMarketDrawAdjustment(30, [20], [], [-0.5], []), -0.42857142857142855)
  assert.equal(linearDecayWithMarketDrawAdjust(1.2, 30, [20], [], [-0.5], []), 0.3714285714285715)
  assert.equal(linearDecayWithMarketDrawAdjust(1.2, 86, [20], [], [-0.5], []), 0.05333333333333333)
})

test('GLS decay adds goals already scored', () => {
  assert.equal(linearDecayWithMarketDrawAdjustGls(3, 30, [12], [22]), 4)
})

test('graph payload uses compact GCS record rows', () => {
  const record = {
    base_sup: [
      [0, 0.5, 0.25],
      [30, 0.2, 0],
    ],
    base_gls: [
      [0, 2.8, 2.5],
      [30, 2.2, 2],
    ],
    team1_gls_mins: [20],
    team2_gls_mins: [],
    team1_sup_adjusts: [-0.5],
    team2_sup_adjusts: [],
  }

  assert.deepEqual(getInitialValues(record), { sup: 0.5, gls: 2.8 })

  const payload = buildGraphPayload(record, 0.5, 2.8)
  assert.equal(payload.sup.series[0].market, 0.5)
  assert.equal(Number(payload.sup.series[1].our.toFixed(4)), -0.0952)
  assert.equal(Number(payload.gls.series[1].our.toFixed(4)), 2.8667)
  assert.deepEqual(payload.goals, { home: [20], away: [] })
})
