(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PetalCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const symbols = { '+': '+', '-': '−', '*': '×', '/': '÷' };

  // Fifteen significant figures remove binary rounding noise while preserving
  // useful calculator precision. Keep strings so an unfinished decimal survives.
  function numberText(value) {
    const numeric = Number(value);
    const rounded = Number(numeric.toPrecision(15));
    // Rounding the largest finite doubles upward can cross the overflow limit.
    // In that boundary case preserve the original representable finite value.
    if (!Number.isFinite(rounded) && Number.isFinite(numeric)) return String(numeric);
    return Object.is(rounded, -0) ? '0' : String(rounded);
  }

  /**
   * Offline, DOM-independent calculator with immediate/chained evaluation.
   * All editing methods return getState(); calculate() instead returns a history
   * record { expression, result } or null. History expressions omit the final =.
   * getState().display uses a dot decimal; presentation may localize separately.
   */
  class Calculator {
    constructor() {
      this.clear();
    }

    clear() {
      this.display = '0';
      this.expression = '';
      this.error = false;
      this.errorMessage = '';
      this.accumulator = null;
      this.operator = null;
      this.awaitingOperand = false;
      this.justCalculated = false;
      this.lastOperator = null;
      this.lastOperand = null;
      return this.getState();
    }

    getState() {
      return {
        display: this.display,
        expression: this.expression,
        error: this.error,
        errorMessage: this.errorMessage,
        operator: this.operator,
      };
    }

    _prepareEntry() {
      if (this.error) this.clear();
      if (this.awaitingOperand || this.justCalculated) {
        this.display = '0';
        this.awaitingOperand = false;
        if (this.justCalculated) {
          this.expression = '';
          this.lastOperator = null;
          this.lastOperand = null;
        }
        this.justCalculated = false;
      }
    }

    inputDigit(digit) {
      if (!/^[0-9]$/.test(String(digit))) return this.getState();
      this._prepareEntry();
      const isNegative = this.display.startsWith('-');
      const unsigned = isNegative ? this.display.slice(1) : this.display;
      if (unsigned === '0') this.display = (isNegative ? '-' : '') + digit;
      else if (unsigned.replace(/\D/g, '').length < 15 && !/e/i.test(unsigned)) {
        this.display += digit;
      }
      return this.getState();
    }

    inputDecimal() {
      this._prepareEntry();
      if (!this.display.includes('.') && !/e/i.test(this.display)) this.display += '.';
      return this.getState();
    }

    _fail(message) {
      this.display = 'Error';
      this.error = true;
      this.errorMessage = message;
      this.accumulator = null;
      this.operator = null;
      this.awaitingOperand = false;
      this.justCalculated = false;
      this.lastOperator = null;
      this.lastOperand = null;
      return null;
    }

    _apply(left, operator, right) {
      if (operator === '/' && right === 0) {
        return this._fail('No se puede dividir entre cero.');
      }
      let result;
      if (operator === '+') result = left + right;
      if (operator === '-') result = left - right;
      if (operator === '*') result = left * right;
      if (operator === '/') result = left / right;
      if (!Number.isFinite(result)) return this._fail('El resultado es demasiado grande.');
      return numberText(result);
    }

    chooseOperator(operator) {
      if (!Object.hasOwn(symbols, operator) || this.error) return this.getState();
      if (this.operator && !this.awaitingOperand) {
        const result = this._apply(this.accumulator, this.operator, Number(this.display));
        if (result === null) return this.getState();
        this.display = result;
      }
      this.accumulator = Number(this.display);
      this.operator = operator;
      this.awaitingOperand = true;
      this.justCalculated = false;
      this.lastOperator = null;
      this.lastOperand = null;
      this.expression = `${numberText(this.accumulator)} ${symbols[operator]}`;
      return this.getState();
    }

    calculate() {
      if (this.error) return null;
      const operator = this.operator || (this.justCalculated && this.lastOperator);
      if (!operator) return null;
      const left = this.operator ? this.accumulator : Number(this.display);
      const right = this.operator ? Number(this.display) : this.lastOperand;
      const expression = `${numberText(left)} ${symbols[operator]} ${numberText(right)}`;
      this.expression = `${expression} =`;
      const result = this._apply(left, operator, right);
      if (result === null) return null;
      this.display = result;
      this.accumulator = null;
      this.operator = null;
      this.awaitingOperand = false;
      this.justCalculated = true;
      this.lastOperator = operator;
      this.lastOperand = right;
      return { expression, result };
    }

    percent() {
      if (this.error) return this.getState();
      let value = Number(this.display) / 100;
      if (this.operator === '+' || this.operator === '-') value *= this.accumulator;
      if (!Number.isFinite(value)) {
        this._fail('El resultado es demasiado grande.');
        return this.getState();
      }
      this.display = numberText(value);
      this.awaitingOperand = false;
      this.justCalculated = false;
      this.lastOperator = null;
      this.lastOperand = null;
      if (!this.operator) this.expression = '';
      return this.getState();
    }

    toggleSign() {
      if (this.error) return this.getState();
      if (this.awaitingOperand) {
        this.display = '-0';
        this.awaitingOperand = false;
      } else {
        this.display = this.display.startsWith('-') ? this.display.slice(1) : `-${this.display}`;
      }
      this.justCalculated = false;
      this.lastOperator = null;
      this.lastOperand = null;
      if (!this.operator) this.expression = '';
      return this.getState();
    }

    backspace() {
      if (this.error) return this.clear();
      if (this.awaitingOperand) return this.getState();
      if (/e/i.test(this.display)) this.display = '0';
      else this.display = this.display.slice(0, -1);
      if (this.display === '' || this.display === '-') this.display = '0';
      this.justCalculated = false;
      this.lastOperator = null;
      this.lastOperand = null;
      if (!this.operator) this.expression = '';
      return this.getState();
    }

    setValue(value) {
      const text = String(value).trim();
      if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || !Number.isFinite(Number(text))) {
        return this.getState();
      }
      this.clear();
      this.display = numberText(Number(text));
      this.justCalculated = true;
      return this.getState();
    }
  }

  return { Calculator };
});
