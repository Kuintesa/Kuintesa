const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { Calculator } = require('../calculator.js');

function enter(calc, number) {
  for (const character of String(number)) {
    if (character === '.') calc.inputDecimal();
    else calc.inputDigit(character);
  }
}

function operation(left, operator, right) {
  const calc = new Calculator();
  enter(calc, left);
  calc.chooseOperator(operator);
  enter(calc, right);
  return { calc, record: calc.calculate() };
}

test('performs arithmetic and emits a history record', () => {
  const { calc, record } = operation('12.5', '*', '4');
  assert.deepEqual(record, { expression: '12.5 × 4', result: '50' });
  assert.equal(calc.getState().expression, '12.5 × 4 =');
  assert.equal(operation('7', '/', '2').record.result, '3.5');
  assert.equal(operation('7', '-', '9').record.result, '-2');
});

test('removes floating-point rounding artifacts', () => {
  assert.equal(operation('0.1', '+', '0.2').record.result, '0.3');
  assert.equal(operation('0.3', '-', '0.2').record.result, '0.1');
});

test('chains operations in standard calculator order', () => {
  const calc = new Calculator();
  enter(calc, 2);
  calc.chooseOperator('+');
  enter(calc, 3);
  calc.chooseOperator('*');
  assert.equal(calc.getState().display, '5');
  enter(calc, 4);
  assert.equal(calc.calculate().result, '20');
});

test('changing a pending operator does not evaluate prematurely', () => {
  const calc = new Calculator();
  enter(calc, 8);
  calc.chooseOperator('+');
  calc.chooseOperator('/');
  enter(calc, 2);
  assert.equal(calc.calculate().result, '4');
});

test('equals repeats the previous operand and operation', () => {
  const { calc } = operation(10, '+', 2);
  assert.equal(calc.calculate().result, '14');
  assert.equal(calc.calculate().result, '16');
  calc.inputDigit('7');
  assert.equal(calc.getState().display, '7');
  assert.equal(calc.calculate(), null);
});

test('equals after only an operator uses the displayed operand', () => {
  const calc = new Calculator();
  enter(calc, 5);
  calc.chooseOperator('+');
  assert.equal(calc.calculate().result, '10');
});

test('addition and subtraction percentages are relative to the first operand', () => {
  for (const [operator, result] of [['+', '220'], ['-', '180']]) {
    const calc = new Calculator();
    enter(calc, 200);
    calc.chooseOperator(operator);
    enter(calc, 10);
    calc.percent();
    assert.equal(calc.getState().display, '20');
    assert.equal(calc.calculate().result, result);
  }
});

test('multiplication and standalone percentages use fractions', () => {
  const calc = new Calculator();
  enter(calc, 200);
  calc.chooseOperator('*');
  enter(calc, 10);
  calc.percent();
  assert.equal(calc.calculate().result, '20');
  calc.clear();
  enter(calc, 50);
  calc.percent();
  assert.equal(calc.getState().display, '0.5');
});

test('division by zero reports an error and fresh entry recovers', () => {
  const { calc, record } = operation(2, '/', 0);
  assert.equal(record, null);
  assert.equal(calc.getState().error, true);
  assert.match(calc.getState().errorMessage, /cero/);
  calc.inputDigit('9');
  assert.equal(calc.getState().display, '9');
  assert.equal(calc.getState().error, false);
});

test('decimal entry, signed operands, and deletion retain correct entry state', () => {
  const calc = new Calculator();
  calc.inputDecimal();
  calc.inputDecimal();
  enter(calc, 25);
  assert.equal(calc.getState().display, '0.25');
  calc.chooseOperator('*');
  calc.toggleSign();
  enter(calc, 4);
  assert.equal(calc.calculate().result, '-1');
  calc.backspace();
  assert.equal(calc.getState().display, '0');
});

test('limits manual entry and ignores invalid inputs', () => {
  const calc = new Calculator();
  enter(calc, '12345678901234567');
  assert.equal(calc.getState().display, '123456789012345');
  calc.inputDigit('<script>');
  calc.chooseOperator('**');
  assert.equal(calc.getState().display, '123456789012345');
  assert.equal(calc.getState().operator, null);
});

test('setValue restores history values and rejects non-numeric content', () => {
  const calc = new Calculator();
  calc.setValue('-2.5');
  assert.equal(calc.getState().display, '-2.5');
  calc.chooseOperator('*');
  enter(calc, 2);
  assert.equal(calc.calculate().result, '-5');
  calc.setValue('Infinity');
  assert.equal(calc.getState().display, '-5');
});

test('overflow is a recoverable error', () => {
  const calc = new Calculator();
  calc.setValue('1e308');
  calc.chooseOperator('*');
  enter(calc, 10);
  assert.equal(calc.calculate(), null);
  assert.equal(calc.getState().error, true);
  calc.inputDecimal();
  assert.equal(calc.getState().display, '0.');
  assert.equal(calc.getState().error, false);
});

test('classic browser loading exposes the same API without a module loader', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../calculator.js'), 'utf8'), context);
  const calc = new context.PetalCalculator.Calculator();
  calc.inputDigit('3');
  assert.equal(calc.getState().display, '3');
});

test('rounding a valid boundary value never introduces unreported infinity', () => {
  const calc = new Calculator();
  calc.setValue(Number.MAX_VALUE);
  assert.equal(Number(calc.getState().display), Number.MAX_VALUE);
  assert.equal(calc.getState().error, false);
  calc.chooseOperator('*');
  enter(calc, 1);
  assert.equal(Number(calc.calculate().result), Number.MAX_VALUE);
  assert.equal(calc.getState().error, false);
});

test('chained relative percentages use the latest subtotal', () => {
  const calc = new Calculator();
  enter(calc, 200);
  calc.chooseOperator('+');
  enter(calc, 10);
  calc.percent();
  calc.chooseOperator('+');
  enter(calc, 10);
  calc.percent();
  assert.equal(calc.getState().display, '22');
  assert.equal(calc.calculate().result, '242');
});

test('a signed decimal operand preserves the pending operation', () => {
  const calc = new Calculator();
  enter(calc, 2);
  calc.chooseOperator('+');
  calc.toggleSign();
  calc.inputDecimal();
  enter(calc, 25);
  assert.equal(calc.getState().display, '-0.25');
  assert.equal(calc.calculate().result, '1.75');
});

test('unary edits invalidate stale repeated-equals operations', () => {
  const { calc } = operation(5, '+', 5);
  calc.percent();
  assert.equal(calc.getState().display, '0.1');
  assert.equal(calc.calculate(), null);
  calc.chooseOperator('+');
  enter(calc, 1);
  assert.equal(calc.calculate().result, '1.1');
  calc.toggleSign();
  assert.equal(calc.getState().display, '-1.1');
  assert.equal(calc.calculate(), null);
});
