# SPL-Token 2022 Transfer Hook with Anchor Framework Example

## Overview

This repository contains an example implementation of the SPL-Token 2022 Transfer Hook Program Interface using Anchor Framework. In addition to demonstrating the basic functionality of a transfer hook, this example also includes a feature to count the number of times the transfer hook has been invoked.

## Getting Started

1. Clone this repository to your local machine:

   ```
   git clone https://github.com/imalic3/spl-token-2022-transfer-hook-anchor.git
   ```

2. Navigate to the project directory:

   ```
   cd spl-token-2022-transfer-hook-anchor
   ```

3. Install project dependencies:

   ```
   anchor build
   ```

## Usage

To run the example transfer hook, follow these steps:

1. Start a local Solana cluster:

   ```
   solana-test-validator
   ```

2. Run the example transfer hook:

   ```
   anchor test --skip-local-validator
   ```

This will execute the transfer hook, demonstrating its functionality with SPL-Token transactions.

## How it works

Here's an illustrates the process of an SPL-Token transfer hook interface works with Hook Program.

```mermaid
sequenceDiagram
    participant A as Authority
		participant T as Token 2022
		participant H as Hook Program
    participant M as Mint
		participant EX as Extra Account Metas (PDA)
		participant R as Recipient

A ->> T: Create Mint Account
activate T
T ->> M: Create Mint
M -->> T: CPI Result
T -->> A: Result
deactivate T
A ->> T: Initialize Transfer Hook	(Resize + Init Extension on Mint<br>with Hook Program Id and Authority)
T -->> A: Result
A ->> T: Initialize Mint
T ->> M: Initialize
M -->> T: CPI Result
T -->> A: Result
A ->> H: Initialize Extra Account Meta List PDA via "spl-transfer-hook-interface:initialize-extra-account-metas"
H ->> EX: Write extra account meta list with seeds<br>("extra-account-metas" + mint + hook program id)<br>(some of SOL is required to rent)
EX -->> H: Result
H -->> A: Result
A ->> H: Resolve extra account meta list<br>(using PDA ("extra-account-metas" + mint + hook program id))
H -->> A: Extra account meta list
A ->> A: Append extra accounts + hook program id<br>in transfer_checked instruction
A ->> T: Transfer token using transfer_checked
T ->> T: Set both sender and receiver<br>token accounts flag (transferring=true)
T ->> H: Call "spl-transfer-hook-interface:execute"<br>with extra accounts
H ->> H: Doing side-effect
H -->> T: Result
T ->> R: Transfer
R -->> T: Result
T -->> A: Result
```

## Contributing

If you find any issues or have suggestions for improvements, please feel free to open an issue or create a pull request.

## License

This project is licensed under the [MIT License](LICENSE).
