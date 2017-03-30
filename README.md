Ember Inspector Prebuilt
===============

Built with love from the development branch of [ember-inspector](https://github.com/emberjs/ember-inspector)

Adds an Ember tab to Chrome or Firefox Developer Tools that allows you to inspect
Ember objects in your application.

Installation
------------

### Chrome

Install the extension from the [Chrome Web Store](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi).

OR:

- Clone this repository
- cd into the dist directory
- Visit chrome://extensions in chrome
- Make sure `Developer mode` is checked
- Click on 'Load unpacked extension...'
- Choose the `dist/chrome` folder in the cloned repo
- Close and re-open developer tools if it's already open

### Firefox

Install the [Firefox addon](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/).

OR:

- Clone the repository
- cd into the repo directory
- Open about:addons using the firefox url bar
- Select "Install Addon From File"
- Choose the dist/ember-inspector@version.xpi file
- You may need to enable installation of unsigned extensions

### Opera

- Clone the repository
- cd into the repo directory
- Visit chrome://extensions in opera
- Make sure `Developer Mode` is checked
- Click on 'Load unpacked extension...'
- Choose the `dist/chrome` folder in the cloned repo
- Close and re-open developer tools if it's already open

### Window Messages

The Ember Inspector uses window messages, so if you are using window messages in your application code, make sure you [verify the sender](https://developer.mozilla.org/en-US/docs/Web/API/window.postMessage#Security_concerns) and add checks to your event listener so as not to conflict with the inspector's messages.
