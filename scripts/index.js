const { ethers, waffle } = require("hardhat");
require('dotenv').config;

const DAI =  '0x6b175474e89094c44da98b954eedeac495271d0f';
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // dai<weth->dai is token0
const UNI2_ROUTER = ''; //used for getAmountIn and Out -> idnependent of dex
//home = WETH

const addresses = {
    'UniswapV2': '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11',
    'Sushiswap': '0xc3d03e4f041fd4cd388c549ee2a29a9e5075882f',
    'Shebaswap' : '0x8faf958e36c6970497386118030e6297fff8d275',
    'Sakeswap': '0x2ad95483ac838e2884563ad278e933fba96bc242',
    'Croswap': '0x60a26d69263ef43e9a68964ba141263f19d71d51'};

const abiPool = ["function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"];

const abiUniMath = ["function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) public pure virtual override returns (uint amountOut)",
"function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) public pure virtual override returns (uint amountIn)"]

const abiSwapRelay = ["function execArb(address firstPool, address secondPool, uint256 amountDaiOut, uint256 amountEthOut) external payable returns(uint256)"];

const provider = waffle.provider;


async function main() {
    // -- init --
    let contracts = {};
    for (const [dex, adr] of Object.entries(addresses)) {
        contracts[dex]=new ethers.Contract(adr, abiPool, provider);
    }
    const quoteOut = new ethers.Contract(UNI2_ROUTER, abiUniMath, provider);

    const swapRelay = new ethers.Contract(abiSwapRelay, provider);

    const [deployer] = await ethers.getSigners();

    // -- in live, provider.on('mined') starts here, looking for arb after each new block
    try {
        // --get prices and sort them --
        let prices = {};
        let reserves = {};
        for (const [dex, contract] of Object.entries(contracts)) {
            const [reserve0, reserve1] = await contract.getReserves();           
            const curr_price = reserve0.div(reserve1);
            prices[dex] = curr_price;
            reserves[dex] = [reserve0, reserve1];
            console.log(dex+" : "+prices[dex].toString());
            console.log(dex+" "+reserves[dex]);
        }

        const sorted_prices = Object.fromEntries(
            Object.entries(prices).sort(([,a],[,b]) => a-b)
        );

        // assuming other pools are pure clone, with the same flat fees as uniswap
        console.log(sorted_prices);

        // -- payload :
        // -- first leg: ETH->DAI 
        

        quoteOut.getAmountsOut
        quoteOut.getAmountsIn

        execArb(in, out, amount, {value: amount})

        sell prices[n-1]
        buy prices[0]

        
        let minPrice = 2**256;
        let maxPrice = 0;

        //delete price[dex];
    } catch (e) {
        console.log(e);
    }
}

// [_reserve0, _reserve1, lastTs] = pair.getReserves();

/* sort by asc order
 arb the extrema, pop(extrema), arb extrema  --  if 2 price identical, take the biggest liq
 max slippage = target price !
 transfer in to pair
 pair.swap */



main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
