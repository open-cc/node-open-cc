# @open-cc/api

A generic container for event driven micro-services.

## Installation
```shell
npm install @open-cc/api -g
```

## Usage

Create a .js file which exports a function which accepts `router` instance and `es` runtime.

```javascript
module.exports = (router, es) => {
}
```

Launch the API by running `open-cc-api-container` and providing a list of APIs to load in an environment variable named `SERVICES`.

```shell
SERVICES=myapi.js open-cc-api-container
```

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details