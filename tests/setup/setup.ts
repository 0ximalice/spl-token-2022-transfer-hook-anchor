export const IS_DEBUG = process.env.DEBUG === "true";

if (IS_DEBUG) {
  // Ref: https://medium.com/front-end-weekly/stack-traces-for-promises-in-node-js-46bf5f490fe4
  global.Promise = require("bluebird");
  console.log(
    "Running tests in DEBUG mode, tests will run serially and transaction errors " +
      "will be displayed. Finally, Bluebird's Promise implementation will be used " +
      "to enable more informative stack traces."
  );
} else {
  console.log(
    "Running tests in regular mode. Run yarn test-debug to see output if tests fail."
  );
}
