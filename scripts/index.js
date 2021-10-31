const { ethers, waffle } = require("hardhat");
const fetch = require('node-fetch');
require('dotenv').config;

const DAI =  '0x6b175474e89094c44da98b954eedeac495271d0f';
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // dai<weth -> dai is token0

const addresses = {
    'UniswapV2': '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11',
    'Sushiswap': '0xc3d03e4f041fd4cd388c549ee2a29a9e5075882f',
    'Shebaswap' : '0x8faf958e36c6970497386118030e6297fff8d275',
    'Sakeswap': '0x2ad95483ac838e2884563ad278e933fba96bc242',
    'Croswap': '0x60a26d69263ef43e9a68964ba141263f19d71d51'};

const abiPool = ["function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"];
const provider = waffle.provider;

const GWEI = ethers.BigNumber.from(10).pow(18);


async function main() {
    // -- init --
    let contracts = {};
    for (const [dex, adr] of Object.entries(addresses)) {
        contracts[dex]=new ethers.Contract(adr, abiPool, provider);
    }
    const Contract = await ethers.getContractFactory("ExecArb", provider);
    const ExecArb = await Contract.deploy();
    const [signer] = await ethers.getSigners();


    // In live, provider.on('mined') starts here, looking for arb after each new block
    // (hardhat node doesn't provide such rpc endpoint)
    try {
        // Get prices from each pool and sort them
        let prices = {};
        let reserves = {};
        for (const [dex, contract] of Object.entries(contracts)) {
            const [reserveDai, reserveWeth] = await contract.getReserves();           
            const curr_price = reserveDai.div(reserveWeth);
            prices[dex] = curr_price.toNumber();
            reserves[dex] = [reserveDai, reserveWeth];
        }

        const pricesSortedArr = Object.values(prices);
        pricesSortedArr.sort().reverse();

        let maxProfit = {maxEthReceived: 0, gas: 0, firstLeg: null, secondLeg: null};

        // Try every possible arb, from ETH to ETH (ie we a potential ev+, since the nested for
        // only goes from "expensive to cheap eth" (other direction, when starting 
        // from eth, is a buy expensive DAI/sell cheap DAI - EV neg)
        
        for(let firstLeg=0; firstLeg<5; firstLeg++) {
            for(let secondLeg=firstLeg+1; secondLeg<5; secondLeg++) {
                const currentFirstPool = Object.keys(prices).find(key => prices[key] === pricesSortedArr[firstLeg]);
                const currentSecondPool = Object.keys(prices).find(key => prices[key] === pricesSortedArr[secondLeg]);

                console.log("Checking "+currentFirstPool+"@"+prices[currentFirstPool]+"->"+currentSecondPool+"@"+prices[currentSecondPool]);

                const {eth_received, gas} = await simArb(currentFirstPool, currentSecondPool);

                if(eth_received > maxProfit.maxEthReceived) {
                    maxProfit.maxEthReceived = eth_received;
                    maxProfit.gas = gas;
                    maxProfit.firstLeg = currentFirstPool;
                    maxProfit.secondLeg = currentSecondPool;
                    console.log("New max : from "+currentFirstPool+" to "+currentSecondPool+"; delta : "+curr_profit);
                }
            }
        }

        //current gas price (returns maxTotalFee)
        const gas_api = await fetch("https://www.etherchain.org/api/gasnow");
        const gas_api_response = await gas_api.json();
        const fast_gas = gas_api_response.data.rapid;

        // is the max profit really EV+ when taking gas into account ?
        if(maxProfit.maxEthReceived>maxProfit.gas*fast_gas) {
            const net_profit = maxProfit.maxEthReceived - gas*fast_gas;
            console.log("Arb : "+maxProfit.firstLeg+" -> "+maxProfit.secondLeg+" - NET PROFIT :"+net_profit);
        } else console.log("no free lunch atm");


        
        async function simArb(currentFirstPool, currentSecondPool) {
            const [reserve_Dai_firstPool, reserve_Weth_firstPool] = reserves[currentFirstPool];
            const [reserve_Dai_secondPool, reserve_Weth_secondPool] = reserves[currentSecondPool];
            const priceOut = prices[currentSecondPool];
                
            // -- computing first leg, eth to dai: --

            //how much dai to take the biggest spread ?
            //params : truePriceDai, truePriceEth, reserveDai, reserveEth
            const amountDai = await ExecArb.computeProfitMaximizingTrade(priceOut, 1, reserve_Dai_firstPool, reserve_Weth_firstPool);
            if(amountDai == 0) return 0;
            
            //how much eth needs to get swapped in first pool to get there ?
            const numerator = reserve_Weth_firstPool.mul(amountDai).mul(1000);
            const denominator = reserve_Dai_firstPool.sub(amountDai).mul(997); // uni fee
            const amountInEth = numerator.div(denominator).add(1);
    
            // -- computing second leg, dai to eth: --
            // how much eth would we get from swapping dai from first leg into the second pool ?
            const amountInWithFee = amountDai.mul(997); //fee
            const num = amountInWithFee.mul(reserve_Weth_secondPool);
            const denom = reserve_Dai_secondPool.mul(1000).add(amountInWithFee);
            const amountOutEth = num.div(denom);
        
            // static call to simulate the actual arb + estimate the gas consumption
            const DaiToEth = await ExecArb.callStatic.execArb(contracts[currentFirstPool].address, contracts[currentSecondPool].address, amountDai, amountOutEth, {value: amountInEth});
            const gasEstim = await ExecArb.estimateGas.execArb(contracts[currentFirstPool].address, contracts[currentSecondPool].address, amountDai, amountOutEth, {value: amountInEth});
            console.log("simulated eth from closing second leg: "+DaiToEth);
        
            return amountOutEth.sub(amountInEth), gasEstim;
        }

    } catch (e) {
        console.log(e);
    }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
