-- UNAUDITED and probably optimizable in so many ways --
----------------------------------------------------------------------

## WETH-DAI Uniswap V2-clones arb

Tests need to be run on a fork of ethereum mainnet, via :

    npm i
    npx hardhat run scripts/index.js
    

Exploit arbitrage opportunities between the following dex, on the weth-dai pair :

Exchange addresses:
**UniswapV2** https://etherscan.io/address/0xa478c2975ab1ea89e8196811f51a7b7ade33eb11
**Sushiswap** https://etherscan.io/address/0xc3d03e4f041fd4cd388c549ee2a29a9e5075882f
**Shebaswap** https://etherscan.io/address/0x8faf958e36c6970497386118030e6297fff8d275
**Sakeswap** https://etherscan.io/address/0x2ad95483ac838e2884563ad278e933fba96bc242
**Croswap** https://etherscan.io/address/0x60a26d69263ef43e9a68964ba141263f19d71d51

Token addresses:

**WETH** https://etherscan.io/address/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
**DAI** https://etherscan.io/address/0x6b175474e89094c44da98b954eedeac495271d0f



# Possible improvements :
- Those arbs are not leveraged but can be accomplished with
the use of a weth flashloan and/or dai flashmint
- The opportunities are based on last mined block -> getting the swap waiting in txpool would give another extra hedge (the ideal situation would then
be getting included as the LAST tx from the block, effectively frontrunning the following block)
- Safety check -> pass the prices observed by the bot to execArb, revert (+/- recompute) if
huge difference (avoid loosing when being frontran)
- ComputeMaximizedProfit should be adapted in JS, avoiding waisting time waiting for a promise
to resolve
