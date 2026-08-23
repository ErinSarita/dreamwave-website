/* features.js — what this build of the app includes.
 *
 * There are two builds from one set of files. The public website is the
 * wheel and the sky: everything is computed on the visitor's own device and
 * nothing about them is stored. The personal app is that plus the parts that
 * hold a person's own life, which is a different promise and a different set
 * of duties, so it is kept off the open web deliberately rather than by
 * accident.
 *
 * This file is the only difference between them. Flip a flag, redeploy, and
 * the feature and its storage are both gone: no dead panel, no key left
 * sitting in localStorage, nothing written that later has to be defended.
 * The code for it stays in place, so nothing has to be rebuilt to bring it
 * back for the app.
 */
(function (global) {
  'use strict';

  global.FEATURES = {
    /* Which build this is. The public site and the private lab sit on the
     * same domain, which means they share one browser storage box, so their
     * keys have to be kept apart or testing the lab would quietly rewrite
     * what a visitor to the public site had saved. */
    ns: 'lab',

    /* Per-day notes: the editor on the day clock, the noted-day marks on the
     * wheel, the "on this date before" history, and the backup and restore
     * of the whole file. Off for the website, on for the personal app. */
    notes: true,

    /* The menstrual and pregnancy wheels. They read a person's own body
     * against the year, which is the most private thing here, so they belong
     * with the account rather than on the open page. */
    bodyCycles: true
  };
})(typeof window !== 'undefined' ? window : globalThis);
