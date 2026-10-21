/* Handled HomeCare website settings.

   Turn on online requests (EmailJS):
   1. In EmailJS, add your email service and create the request template (see the notes in CLAUDE.md).
   2. Copy the Service ID, the Template ID, and your Public Key (Account > General).
   3. Paste all three between the quotes below, save, and re-upload the site.

   Until all three are filled in, the request form runs in preview mode and sends nothing.
   Tip: add ?team to the end of the web address to see the photo-shooting notes. */
window.HH_SITE = {
  emailjs: {
    serviceId: "PASTE_YOUR_EMAILJS_SERVICE_ID_HERE",
    templateId: "PASTE_YOUR_EMAILJS_TEMPLATE_ID_HERE",
    publicKey: "PASTE_YOUR_EMAILJS_PUBLIC_KEY_HERE"
  }
};
