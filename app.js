const sendForm = document.getElementById('send-form');
const sendButton = document.getElementById('send-button');
const outputDiv = document.getElementById('output');

sendButton.addEventListener('click', async () => {
  const privateKey = document.getElementById('private-key').value.trim();
  const toAddresses = sendForm.elements['to-addresses'].value.split('\n')
    .map(address => address.trim())
    .filter(address => address !== '');

  if (!privateKey) {
    outputDiv.textContent = 'Please enter a private key';
    return;
  }

  if (toAddresses.length === 0) {
    outputDiv.textContent = 'Please enter at least one recipient address';
    return;
  }

  outputDiv.textContent = '';

  try {
    await sendTransactions(privateKey, toAddresses);
  } catch (error) {
    outputDiv.textContent = `Error: ${error.message}`;
  }
});

async function sendTransactions(privateKey, toAddresses) {
  const web3 = new Web3(new Web3.providers.HttpProvider('https://artio.rpc.berachain.com'));
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);

  // 检查账户地址是否有效
  if (!web3.utils.isAddress(account.address)) {
    throw new Error(`Invalid account address: ${account.address}`);
  }

  let gasPrice = await web3.eth.getGasPrice();
  gasPrice = web3.utils.toHex(gasPrice); // 将 gasPrice 转换为十六进制字符串

  const balance = await web3.eth.getBalance(account.address);
  const accountBalance = web3.utils.toBN(balance);

  for (const toAddress of toAddresses) {
    try {
      const receipt = await sendSingleTransaction(web3, account, toAddress, '0.3', gasPrice, accountBalance);
      outputDiv.innerHTML += `Transaction sent from ${account.address} to ${toAddress} with hash: <a href="https://artio.beratrail.io/tx/${receipt.transactionHash}" rel="noopener" target="_blank">${receipt.transactionHash}</a><br>`;
    } catch (error) {
      outputDiv.textContent += `Error sending transaction to ${toAddress}: ${error.message}\n`;
    }
  }
}

async function sendSingleTransaction(web3, account, toAddress, value, gasPrice, accountBalance) {
  const transaction = {
    from: account.address,
    to: toAddress,
    value: web3.utils.toWei(value, 'ether'),
    gas: await web3.eth.estimateGas({ from: account.address, to: toAddress, value: web3.utils.toWei(value, 'ether') }),
    gasPrice: gasPrice
  };

  const totalGasCost = web3.utils.toBN(transaction.gas).mul(web3.utils.toBN(gasPrice));

  if (totalGasCost.gt(accountBalance)) {
    throw new Error('Insufficient balance to pay gas');
  }

  const signedTx = await account.signTransaction(transaction);
  return await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
}
