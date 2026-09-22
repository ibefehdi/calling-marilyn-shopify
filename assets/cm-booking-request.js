import { Component } from '@theme/component';

/**
 * @typedef {object} CmBookingRequestRefs
 * @property {HTMLInputElement} dateInput
 * @property {HTMLSelectElement} timeInput
 * @property {HTMLElement} error
 * @property {HTMLElement} errorHeading
 */

/**
 * Validates requested date and time on booking products before add to cart.
 * @extends {Component<CmBookingRequestRefs>}
 */
class CmBookingRequest extends Component {
  requiredRefs = ['dateInput', 'timeInput', 'error', 'errorHeading'];

  /** @type {HTMLFormElement | null} */
  #form = null;

  connectedCallback() {
    super.connectedCallback();

    this.#form = this.#getForm();
    this.#form?.addEventListener('click', this.#handleFormClick, true);
    this.#form?.addEventListener('submit', this.#handleSubmit, true);
    this.refs.dateInput.addEventListener('input', this.#handleInput);
    this.refs.timeInput.addEventListener('change', this.#handleInput);
  }

  disconnectedCallback() {
    this.#form?.removeEventListener('click', this.#handleFormClick, true);
    this.#form?.removeEventListener('submit', this.#handleSubmit, true);
    this.refs.dateInput.removeEventListener('input', this.#handleInput);
    this.refs.timeInput.removeEventListener('change', this.#handleInput);
    super.disconnectedCallback();
  }

  /**
   * @returns {HTMLFormElement | null}
   */
  #getForm() {
    const formId = this.dataset.formId;
    if (!formId) return null;

    const form = document.getElementById(formId);
    return form instanceof HTMLFormElement ? form : null;
  }

  /**
   * Sync validity before the add-to-cart button runs checkValidity().
   * @param {MouseEvent} event
   */
  #handleFormClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const submitControl = target.closest('[type="submit"], .add-to-cart-button');
    if (!submitControl || !this.#form?.contains(submitControl)) return;

    if (!this.#syncValidity()) {
      this.#showError();
    } else {
      this.#hideError();
    }
  };

  #handleInput = () => {
    this.#syncValidity();

    if (this.refs.dateInput.value && this.refs.timeInput.value) {
      this.#hideError();
    }
  };

  /**
   * @param {SubmitEvent} event
   */
  #handleSubmit = (event) => {
    if (this.#syncValidity()) {
      this.#hideError();
      return;
    }

    event.preventDefault();
    this.#showError();
  };

  /**
   * @returns {boolean}
   */
  #syncValidity() {
    const { dateInput, timeInput } = this.refs;
    const dateValue = dateInput.value.trim();
    const timeValue = timeInput.value.trim();
    const minDate = dateInput.min;
    let dateMessage = '';

    if (dateValue === '') {
      dateMessage = 'Choose a requested date';
    } else if (minDate && dateValue < minDate) {
      dateMessage = 'Choose today or a later date';
    }

    const timeMessage = timeValue === '' ? 'Choose a requested time' : '';

    dateInput.setCustomValidity(dateMessage);
    timeInput.setCustomValidity(timeMessage);
    dateInput.setAttribute('aria-invalid', dateMessage ? 'true' : 'false');
    timeInput.setAttribute('aria-invalid', timeMessage ? 'true' : 'false');

    return dateMessage === '' && timeMessage === '';
  }

  #showError() {
    const { error, errorHeading } = this.refs;
    error.hidden = false;

    requestAnimationFrame(() => {
      errorHeading.focus();
      errorHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  #hideError() {
    this.refs.error.hidden = true;
  }
}

if (!customElements.get('cm-booking-request')) {
  customElements.define('cm-booking-request', CmBookingRequest);
}
