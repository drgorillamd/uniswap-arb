async function main() {
  const router_address = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
  const quoter_address = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  console.log("Chain id:", (await deployer.getChainId()));

  const Contract = await ethers.getContractFactory("uniV3Relayed");
  const contract = await Contract.deploy(router_address, quoter_address);

  console.log("Contract address:", contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
