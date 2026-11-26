import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMeasurementReadiness } from '../measurementDefinitions.js';
import { recommendFromSizeChart, getFitRecommendationPresentation } from '../fitRecommendation.js';

test('blank, null, boolean and nonpositive measurements never satisfy a required field', () => {
  for (const chest of [null, undefined, '', ' ', 0, -1, false, true, NaN, Infinity, 'abc']) {
    assert.equal(evaluateMeasurementReadiness('tshirts', {chest}).ready, false);
  }
  assert.equal(evaluateMeasurementReadiness('tshirts', {chest: '100'}).ready, true);
  assert.equal(evaluateMeasurementReadiness('tshirts', {bust: 100}).ready, true);
});

test('remembered shoe and bra sizes cannot override an unrelated clothing chart', () => {
  const chart = [{size:'9',chest_min_cm:70,chest_max_cm:80},{size:'34B',chest_min_cm:80,chest_max_cm:90},{size:'M',chest_min_cm:95,chest_max_cm:105}];
  const r = recommendFromSizeChart(chart, {chest:100}, {category:'tshirts',shoeSize:'9',braSize:'34B'});
  assert.equal(r.size,'M');
  assert.equal(r.blocked,false);
});

test('footwear identity remains available for footwear categories', () => {
  const chart = [{size:'9',foot_length_min_cm:26,foot_length_max_cm:27,foot_width_min_cm:9,foot_width_max_cm:11}];
  const r = recommendFromSizeChart(chart, {foot_length:26.5,foot_width:10}, {category:'shoes',shoeSize:'9'});
  assert.equal(r.size,'9');
  assert.equal(r.blocked,false);
});

test('missing measurements block a partial pants chart recommendation', () => {
  const r = recommendFromSizeChart([{size:'M',waist_min_cm:80,waist_max_cm:90}], {waist:85,hips:null,inseam:''}, {category:'pants'});
  assert.equal(r.blocked,true);
  assert.equal(r.missingMeasurements.length,2);
});

test('chart match never claims physically verified fit', () => {
  for (const source of ['product_size_chart','brand_size_chart']) {
    for (const match of ['exact','nearest']) {
      const p = getFitRecommendationPresentation(source,match);
      assert.equal(p.verified,false);
      assert.match(p.label,/chart match/i);
      assert.match(p.detail,/actual fit is not guaranteed/i);
    }
  }
});
