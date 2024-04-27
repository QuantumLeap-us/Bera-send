const sendForm = document.getElementById('send-form');
const sendButton = document.getElementById('send-button');
const outputDiv = document.getElementById('output');

sendButton.addEventListener('click', async () => {
  const privateKeys = document.getElementById('private-key').value.split('\n')
    .map(key => key.trim())
    .filter(key => key !== '');

  const toAddresses = sendForm.elements['to-addresses'].value.split('\n')
    .map(address => address.trim())
    .filter(address => address !== '');

  if (privateKeys.length === 0) {
    outputDiv.textContent = 'Please enter at least one private key';
    return;
  }

  if (toAddresses.length === 0) {
    outputDiv.textContent = 'Please enter at least one recipient address';
    return;
  }

  outputDiv.textContent = '';

  let numTransactions = 0;
  let numErrors = 0;

  for (const privateKey of privateKeys) {
    try {
      const transactions = await sendTransactions(privateKey, toAddresses);
      numTransactions += transactions.length;
      transactions.forEach(({ transactionHash, from, to, value }, index) => {
        outputDiv.innerHTML += `Transaction #${numTransactions - transactions.length + index + 1} sent from ${from} with hash: <a href="https://artio.beratrail.io/tx/${transactionHash}" rel="noopener" target="_blank">${transactionHash}</a><br>`;
        outputDiv.innerHTML += `Sent ${value} BERA to ${to}<br><br>`;
        trackTransaction(transactionHash, from, to, value);
      });
    } catch (error) {
      numErrors++;
      outputDiv.textContent += `Error sending transactions from ${error.from}: ${error.message}\n`;
    }
  }

  if (numErrors > 0) {
    outputDiv.textContent += `Failed to send ${numErrors} transaction${numErrors === 1 ? '' : 's'}\n`;
  }
});

async function sendTransactions(privateKey, toAddresses) {
  const web3 = new Web3(new Web3.providers.HttpProvider('https://artio.rpc.berachain.com'));
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);

  // 检查账户地址是否有效
  if (!web3.utils.isAddress(account.address)) {
    throw new Error(`Invalid account address: ${account.address}`);
  }

  const balance = await web3.eth.getBalance(account.address);

  let gasPrice = await web3.eth.getGasPrice();

  const transactions = [];

  for (const toAddress of toAddresses) {
    try {
      const receipt = await sendSingleTransaction(web3, account, toAddress, '0.3', gasPrice, balance);
      transactions.push({
        transactionHash: receipt.transactionHash,
        from: account.address,
        to: toAddress,
        value: '0.5'
      });
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw { from: account.address, message: error.message };
    }
  }

  return transactions;
}

async function sendSingleTransaction(web3, account, toAddress, value, gasPrice, balance) {
  const transaction = {
    from: account.address,
    to: toAddress,
    value: web3.utils.toWei(value, 'ether')
  };

  // 获取估计的 gas Limit
  const gasLimit = await web3.eth.estimateGas(transaction);

  // 将 gasLimit 转换为十六进制字符串
  transaction.gas = web3.utils.toHex(gasLimit);

  transaction.gasPrice = gasPrice;

  // 检查 balance 是否为有效值
  const accountBalance = balance ? web3.utils.toBN(balance) : web3.utils.toBN(0);

  const totalGasCost = web3.utils.toBN(transaction.gas).mul(gasPrice);

  if (totalGasCost.gt(accountBalance)) {
    throw new Error('Insufficient balance to pay gas');
  }

  const signedTx = await account.signTransaction(transaction);
  const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  console.log('Transaction successful:', receipt.transactionHash);
  return receipt;
}

async function trackTransaction(transactionHash, from, to, value) {
  const web3 = new Web3(new Web3.providers.HttpProvider('https://artio.rpc.berachain.com'));

  const checkInterval = 5000; // 检查间隔时间（5秒）
  const maxAttempts = 30; // 最大尝试次数（2.5分钟）
  let attempts = 0;

  while (attempts < maxAttempts) {
    const receipt = await web3.eth.getTransactionReceipt(transactionHash);
    if (receipt) {
      if (receipt.status) {
        outputDiv.innerHTML += `Transaction from ${from} to ${to} for ${value} BERA succeeded.<br>`;
      } else {
        outputDiv.innerHTML += `Transaction from ${from} to ${to} for ${value} BERA failed.<br>`;
      }
      break;
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    attempts++;
  }

  if (attempts === maxAttempts) {
    outputDiv.innerHTML += `Failed to get transaction receipt for ${transactionHash} from ${from} to ${to} for ${value} BERA.<br>`;
  }
}
