/////////////////////////
// global variable setup
/////////////////////////

// number of zeros required at front of hash
var difficultyMajor = 4;

// 0-15, maximum (decimal) value of the hex digit after the front
// 15 means any hex character is allowed next
// 7  means next bit must be 0 (because 0x7=0111),
//    (so the bit-strength is doubled)
// 0  means only 0x0 can be next
//    (equivalent to one more difficultyMajor)
var difficultyMinor = 15;  

var maximumNonce = 8;  // limit the nonce so we don't mine too long
var pattern = '';
for (var x=0; x<difficultyMajor; x++) {
  pattern += '0';     // every additional required 0
  maximumNonce *= 16; // takes 16x longer to mine
}
// at this point in the setup, difficultyMajor=4
// yields pattern '0000' and maximumNonce 8*16^4=524288

// add one more hex-char for the minor difficulty
pattern += difficultyMinor.toString(16);
var patternLen = pattern.length; // == difficultyMajor+1

if      (difficultyMinor == 0) { maximumNonce *= 16; } // 0000 require 4 more 0 bits
else if (difficultyMinor == 1) { maximumNonce *= 8;  } // 0001 require 3 more 0 bits
else if (difficultyMinor <= 3) { maximumNonce *= 4;  } // 0011 require 2 more 0 bits
else if (difficultyMinor <= 7) { maximumNonce *= 2;  } // 0111 require 1 more 0 bit
// else don't bother increasing maximumNonce, it already started with 8x padding



/////////////////////////
// functions
/////////////////////////
function sha256(block, chain) {
  // calculate a SHA256 hash of the contents of the block
  return CryptoJS.SHA256(getText(block, chain));
}

function updateState(block, chain) {
  // set the well background red or green for this block
  if ($('#block'+block+'chain'+chain+'hash').val().substr(0, patternLen) <= pattern) {
      $('#block'+block+'chain'+chain+'well').removeClass('well-error').addClass('well-success');
  }
  else {
      $('#block'+block+'chain'+chain+'well').removeClass('well-success').addClass('well-error');
  }
}

function updateHash(block, chain) {
  // update the SHA256 hash value for this block
  $('#block'+block+'chain'+chain+'hash').val(sha256(block, chain));
  updateState(block, chain);
}

function updateChain(block, chain) {
  // update all blocks walking the chain from this block to the end
  for (var x = block; x <= 5; x++) {
    if (x > 1) {
      $('#block'+x+'chain'+chain+'previous').val($('#block'+(x-1).toString()+'chain'+chain+'hash').val());
    }
    updateHash(x, chain);
  }
}

function mine(block, chain, isChain) {
  for (var x = 0; x <= maximumNonce; x++) {
    $('#block'+block+'chain'+chain+'nonce').val(x);
    $('#block'+block+'chain'+chain+'hash').val(sha256(block, chain));
    if ($('#block'+block+'chain'+chain+'hash').val().substr(0, patternLen) <= pattern) {
      if (isChain) {
        updateChain(block, chain);
      }
      else {
        updateState(block, chain);
      }
      break;
    }
  }
}

/////////////////////////
// Drag and Drop functionality
/////////////////////////

var draggedBlock = null;
var draggedChain = null;

function initializeDragAndDrop() {
  // Make blocks draggable
  $('.well').each(function() {
    var blockId = $(this).attr('id');
    if (blockId) {
      var matches = blockId.match(/block(\d+)chain(\d+)well/);
      if (matches) {
        var block = parseInt(matches[1]);
        var chain = parseInt(matches[2]);
        
        $(this).attr('draggable', 'true');
        $(this).addClass('draggable-block');
        
        $(this).on('dragstart', function(e) {
          draggedBlock = block;
          draggedChain = chain;
          $(this).addClass('dragging');
          e.originalEvent.dataTransfer.effectAllowed = 'move';
          e.originalEvent.dataTransfer.setData('text/html', $(this).html());
        });
        
        $(this).on('dragend', function(e) {
          $(this).removeClass('dragging');
          draggedBlock = null;
          draggedChain = null;
        });
        
        $(this).on('dragover', function(e) {
          e.preventDefault();
          e.originalEvent.dataTransfer.dropEffect = 'move';
          $(this).addClass('drag-over');
        });
        
        $(this).on('dragleave', function(e) {
          $(this).removeClass('drag-over');
        });
        
        $(this).on('drop', function(e) {
          e.preventDefault();
          $(this).removeClass('drag-over');
          
          if (draggedBlock && draggedChain) {
            var targetMatches = $(this).attr('id').match(/block(\d+)chain(\d+)well/);
            if (targetMatches) {
              var targetBlock = parseInt(targetMatches[1]);
              var targetChain = parseInt(targetMatches[2]);
              
              if (draggedChain !== targetChain) {
                swapBlockData(draggedBlock, draggedChain, targetBlock, targetChain);
              }
            }
          }
        });
      }
    }
  });
}

function swapBlockData(sourceBlock, sourceChain, targetBlock, targetChain) {
  // Get source block data
  var sourceData = $('#block'+sourceBlock+'chain'+sourceChain+'data').val();
  var sourceNonce = $('#block'+sourceBlock+'chain'+sourceChain+'nonce').val();
  
  // Get target block data
  var targetData = $('#block'+targetBlock+'chain'+targetChain+'data').val();
  var targetNonce = $('#block'+targetBlock+'chain'+targetChain+'nonce').val();
  
  // Swap the data
  $('#block'+sourceBlock+'chain'+sourceChain+'data').val(targetData);
  $('#block'+sourceBlock+'chain'+sourceChain+'nonce').val(targetNonce);
  
  $('#block'+targetBlock+'chain'+targetChain+'data').val(sourceData);
  $('#block'+targetBlock+'chain'+targetChain+'nonce').val(sourceNonce);
  
  // Update both chains
  updateChain(1, sourceChain);
  updateChain(1, targetChain);
  
  // Show notification
  showNotification('Block data swapped between Peer ' + String.fromCharCode(64 + sourceChain) + ' and Peer ' + String.fromCharCode(64 + targetChain));
}

function showNotification(message) {
  // Create notification element if it doesn't exist
  if ($('#notification').length === 0) {
    $('body').append('<div id="notification" class="alert alert-info notification-popup" style="display:none;"></div>');
  }
  
  $('#notification').text(message).fadeIn().delay(3000).fadeOut();
}

/////////////////////////
// Transaction Pool functionality
/////////////////////////

var transactionPool = [];

function addTransaction(from, to, amount) {
  var transaction = {
    id: Date.now(),
    from: from,
    to: to,
    amount: amount,
    timestamp: new Date().toISOString()
  };
  transactionPool.push(transaction);
  updateTransactionPool();
  return transaction;
}

function removeTransaction(transactionId) {
  transactionPool = transactionPool.filter(function(tx) {
    return tx.id !== transactionId;
  });
  updateTransactionPool();
}

function updateTransactionPool() {
  var poolHtml = '';
  transactionPool.forEach(function(tx) {
    poolHtml += '<div class="transaction-item" data-tx-id="' + tx.id + '">';
    poolHtml += '<span class="tx-from">' + tx.from + '</span> → ';
    poolHtml += '<span class="tx-to">' + tx.to + '</span>: ';
    poolHtml += '<span class="tx-amount">' + tx.amount + '</span>';
    poolHtml += '<button class="btn btn-xs btn-danger pull-right" onclick="removeTransaction(' + tx.id + ')">×</button>';
    poolHtml += '</div>';
  });
  
  if ($('#transaction-pool').length > 0) {
    $('#transaction-pool').html(poolHtml);
  }
}

function addTransactionFromForm() {
  var from = $('#tx-from').val().trim();
  var to = $('#tx-to').val().trim();
  var amount = parseFloat($('#tx-amount').val());
  
  if (from && to && amount > 0) {
    addTransaction(from, to, amount);
    // Clear form
    $('#tx-from').val('');
    $('#tx-to').val('');
    $('#tx-amount').val('');
    showNotification('Transaction added to pool');
  } else {
    showNotification('Please fill all fields with valid data');
  }
}

function mineAllBlocks() {
  if (transactionPool.length === 0) {
    showNotification('No transactions in pool to mine');
    return;
  }
  
  // Store transactions before clearing
  var transactions = transactionPool.slice(); // Copy the array
  
  // Include transactions in blocks when mining
  var transactionsPerBlock = Math.ceil(transactions.length / 5); // Distribute across 5 blocks
  var transactionIndex = 0;
  
  for (var block = 1; block <= 5; block++) {
    // Add transactions to block data
    var blockTransactions = [];
    for (var i = 0; i < transactionsPerBlock && transactionIndex < transactions.length; i++) {
      blockTransactions.push(transactions[transactionIndex]);
      transactionIndex++;
    }
    
    if (blockTransactions.length > 0) {
      var transactionData = blockTransactions.map(function(tx) {
        return tx.from + '→' + tx.to + ':' + tx.amount;
      }).join('; ');
      
      // Set the data and trigger the update
      $('#block' + block + 'chain1data').val(transactionData).trigger('input');
      
      // Mine the block
      mine(block, 1, true);
    }
  }
  
  // Clear transaction pool immediately after processing
  transactionPool = [];
  updateTransactionPool();
  showNotification('All blocks mined with transactions! Pool cleared.');
}

function resetBlockchain() {
  // Reset all blocks
  for (var block = 1; block <= 5; block++) {
    $('#block' + block + 'chain1nonce').val('0');
    $('#block' + block + 'chain1data').val('');
    updateChain(block, 1);
  }
  
  // Clear transaction pool
  transactionPool = [];
  updateTransactionPool();
  showNotification('Blockchain reset successfully!');
}

/////////////////////////
// Smart Contracts functionality
/////////////////////////

var deployedContracts = {};
var contractEvents = [];

function initializeSmartContracts() {
  $('#compile-contract').click(compileContract);
  $('#deploy-contract').click(deployContract);
  $('#test-contract').click(testContract);
  $('#call-function').click(callContractFunction);
  $('#view-function').click(viewContractFunction);
  
  // Update contract address dropdown when contracts are deployed
  updateContractAddresses();
}

function compileContract() {
  var contractName = $('#contract-name').val().trim();
  var contractCode = $('#contract-code').val().trim();
  
  if (!contractName || !contractCode) {
    showNotification('Please provide contract name and code');
    return;
  }
  
  // Simulate compilation
  var bytecode = CryptoJS.SHA256(contractCode).toString().substring(0, 40);
  $('#contract-bytecode').text('0x' + bytecode);
  $('#contract-bytecode-panel').show();
  
  showNotification('Contract compiled successfully!');
  updateGasUsage(25);
}

function deployContract() {
  var contractName = $('#contract-name').val().trim();
  var contractCode = $('#contract-code').val().trim();
  var constructorParams = $('#constructor-params').val().trim();
  
  if (!contractName || !contractCode) {
    showNotification('Please compile contract first');
    return;
  }
  
  // Generate contract address
  var contractAddress = '0x' + CryptoJS.SHA256(contractName + Date.now()).toString().substring(0, 40);
  
  // Store deployed contract
  deployedContracts[contractAddress] = {
    name: contractName,
    code: contractCode,
    address: contractAddress,
    deployedAt: new Date(),
    constructorParams: constructorParams,
    state: {}
  };
  
  updateDeployedContracts();
  updateContractAddresses();
  addContractEvent('Contract Deployed', contractName + ' deployed at ' + contractAddress);
  
  showNotification('Contract deployed at: ' + contractAddress);
  updateGasUsage(75);
}

function testContract() {
  var contractName = $('#contract-name').val().trim();
  
  if (!contractName) {
    showNotification('Please provide contract name');
    return;
  }
  
  // Simulate contract testing
  var testResults = [
    'Test 1: Constructor - PASSED',
    'Test 2: setValue function - PASSED',
    'Test 3: getValue function - PASSED',
    'Test 4: Access control - PASSED'
  ];
  
  addContractEvent('Contract Tested', testResults.join('<br>'));
  showNotification('Contract tests completed successfully!');
  updateGasUsage(15);
}

function callContractFunction() {
  var contractAddress = $('#contract-address').val();
  var functionName = $('#function-name').val().trim();
  var functionParams = $('#function-params').val().trim();
  
  if (!contractAddress || !functionName) {
    showNotification('Please select contract and function name');
    return;
  }
  
  var contract = deployedContracts[contractAddress];
  if (!contract) {
    showNotification('Contract not found');
    return;
  }
  
  // Simulate function call
  var result = 'Function ' + functionName + ' executed successfully';
  if (functionParams) {
    result += ' with params: ' + functionParams;
  }
  
  $('#function-result').html('<strong>Result:</strong> ' + result).show();
  addContractEvent('Function Called', functionName + ' on ' + contract.name);
  
  showNotification('Function executed successfully!');
  updateGasUsage(30);
}

function viewContractFunction() {
  var contractAddress = $('#contract-address').val();
  var functionName = $('#function-name').val().trim();
  
  if (!contractAddress || !functionName) {
    showNotification('Please select contract and function name');
    return;
  }
  
  var contract = deployedContracts[contractAddress];
  if (!contract) {
    showNotification('Contract not found');
    return;
  }
  
  // Simulate view function
  var result = 'View function result: ' + Math.floor(Math.random() * 1000);
  $('#function-result').html('<strong>View Result:</strong> ' + result).show();
  
  showNotification('View function executed!');
  updateGasUsage(5);
}

function updateDeployedContracts() {
  var html = '';
  Object.keys(deployedContracts).forEach(function(address) {
    var contract = deployedContracts[address];
    html += '<div class="contract-item" style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">';
    html += '<strong>' + contract.name + '</strong><br>';
    html += '<small>Address: ' + address.substring(0, 20) + '...</small><br>';
    html += '<small>Deployed: ' + contract.deployedAt.toLocaleString() + '</small>';
    html += '</div>';
  });
  
  if (html === '') {
    html = '<p class="text-muted">No contracts deployed yet</p>';
  }
  
  $('#deployed-contracts').html(html);
}

function updateContractAddresses() {
  var select = $('#contract-address');
  select.empty().append('<option value="">Select a deployed contract</option>');
  
  Object.keys(deployedContracts).forEach(function(address) {
    var contract = deployedContracts[address];
    select.append('<option value="' + address + '">' + contract.name + ' (' + address.substring(0, 10) + '...)</option>');
  });
}

function addContractEvent(type, description) {
  contractEvents.unshift({
    type: type,
    description: description,
    timestamp: new Date()
  });
  
  // Keep only last 10 events
  if (contractEvents.length > 10) {
    contractEvents = contractEvents.slice(0, 10);
  }
  
  updateContractEvents();
}

function updateContractEvents() {
  var html = '';
  contractEvents.forEach(function(event) {
    html += '<div class="event-item" style="margin-bottom: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">';
    html += '<strong>' + event.type + '</strong><br>';
    html += '<small>' + event.description + '</small><br>';
    html += '<small class="text-muted">' + event.timestamp.toLocaleTimeString() + '</small>';
    html += '</div>';
  });
  
  if (html === '') {
    html = '<p class="text-muted">No events yet</p>';
  }
  
  $('#contract-events').html(html);
}

function updateGasUsage(gasUsed) {
  var currentGas = parseInt($('#gas-usage').attr('aria-valuenow') || '0');
  var newGas = Math.min(currentGas + gasUsed, 100);
  
  $('#gas-usage').css('width', newGas + '%').attr('aria-valuenow', newGas);
  $('#gas-details').text('Gas: ' + (newGas * 10000) + ' / 1,000,000');
  
  if (newGas > 80) {
    $('#gas-usage').removeClass('progress-bar-info').addClass('progress-bar-danger');
  } else if (newGas > 50) {
    $('#gas-usage').removeClass('progress-bar-info progress-bar-danger').addClass('progress-bar-warning');
  }
}

/////////////////////////
// Wallet Management functionality
/////////////////////////

var wallets = {};
var activeWallet = null;
var transactionHistory = [];

function initializeWalletManagement() {
  $('#create-wallet').click(createWallet);
  $('#import-wallet').click(importWallet);
  $('#wallet-type').change(function() {
    if ($(this).val() === 'multisig') {
      $('#multisig-options').show();
    } else {
      $('#multisig-options').hide();
    }
  });
  
  $('#import-method').change(function() {
    var method = $(this).val();
    $('.form-group[id$="-input"]').hide();
    $('#' + method.replace('-', '-') + '-input').show();
  });
  
  // Load sample wallets
  createSampleWallets();
}

function createWallet() {
  var walletName = $('#wallet-name').val().trim();
  var walletType = $('#wallet-type').val();
  
  if (!walletName) {
    showNotification('Please provide wallet name');
    return;
  }
  
  // Generate wallet data
  var privateKey = CryptoJS.SHA256(walletName + Date.now()).toString();
  var publicKey = CryptoJS.SHA256(privateKey + 'public').toString();
  var address = '0x' + CryptoJS.SHA256(publicKey).toString().substring(0, 40);
  
  var wallet = {
    name: walletName,
    type: walletType,
    address: address,
    privateKey: privateKey,
    publicKey: publicKey,
    balance: 1000, // Starting balance
    createdAt: new Date()
  };
  
  if (walletType === 'multisig') {
    wallet.requiredSignatures = parseInt($('#required-signatures').val());
    wallet.totalSigners = parseInt($('#total-signers').val());
    wallet.signers = [];
    
    // Generate additional signer addresses
    for (var i = 0; i < wallet.totalSigners; i++) {
      var signerKey = CryptoJS.SHA256(privateKey + i).toString();
      var signerAddress = '0x' + CryptoJS.SHA256(signerKey).toString().substring(0, 40);
      wallet.signers.push(signerAddress);
    }
  }
  
  if (walletType === 'hd') {
    wallet.mnemonic = generateMnemonic();
    wallet.derivationPath = "m/44'/60'/0'/0/0";
  }
  
  wallets[address] = wallet;
  updateWalletList();
  
  // Clear form
  $('#wallet-name').val('');
  
  showNotification('Wallet created: ' + address);
}

function importWallet() {
  var importMethod = $('#import-method').val();
  var walletName = 'Imported Wallet ' + Object.keys(wallets).length;
  
  var wallet = {
    name: walletName,
    type: 'imported',
    balance: 500,
    createdAt: new Date()
  };
  
  if (importMethod === 'mnemonic') {
    var mnemonic = $('#mnemonic-phrase').val().trim();
    if (!mnemonic) {
      showNotification('Please provide mnemonic phrase');
      return;
    }
    wallet.mnemonic = mnemonic;
    wallet.privateKey = CryptoJS.SHA256(mnemonic).toString();
  } else if (importMethod === 'private-key') {
    var privateKey = $('#private-key').val().trim();
    if (!privateKey) {
      showNotification('Please provide private key');
      return;
    }
    wallet.privateKey = privateKey.replace('0x', '');
  }
  
  wallet.publicKey = CryptoJS.SHA256(wallet.privateKey + 'public').toString();
  wallet.address = '0x' + CryptoJS.SHA256(wallet.publicKey).toString().substring(0, 40);
  
  wallets[wallet.address] = wallet;
  updateWalletList();
  
  showNotification('Wallet imported: ' + wallet.address);
}

function createSampleWallets() {
  // Create some sample wallets
  var sampleWallets = [
    { name: 'Alice Wallet', balance: 1500 },
    { name: 'Bob Wallet', balance: 800 },
    { name: 'Charlie Wallet', balance: 1200 }
  ];
  
  sampleWallets.forEach(function(sample) {
    var privateKey = CryptoJS.SHA256(sample.name + 'sample').toString();
    var publicKey = CryptoJS.SHA256(privateKey + 'public').toString();
    var address = '0x' + CryptoJS.SHA256(publicKey).toString().substring(0, 40);
    
    wallets[address] = {
      name: sample.name,
      type: 'simple',
      address: address,
      privateKey: privateKey,
      publicKey: publicKey,
      balance: sample.balance,
      createdAt: new Date()
    };
  });
  
  updateWalletList();
}

function updateWalletList() {
  var html = '';
  Object.keys(wallets).forEach(function(address) {
    var wallet = wallets[address];
    html += '<div class="wallet-item" style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;" onclick="selectWallet(\'' + address + '\')">';
    html += '<strong>' + wallet.name + '</strong>';
    html += '<span class="pull-right"><span class="label label-success">' + wallet.balance + ' ETH</span></span><br>';
    html += '<small>Address: ' + address.substring(0, 20) + '...</small><br>';
    html += '<small>Type: ' + wallet.type.toUpperCase() + '</small>';
    html += '</div>';
  });
  
  if (html === '') {
    html = '<p class="text-muted">No wallets created yet</p>';
  }
  
  $('#wallet-list').html(html);
}

function selectWallet(address) {
  activeWallet = address;
  var wallet = wallets[address];
  
  var html = '<h4>' + wallet.name + '</h4>';
  html += '<p><strong>Address:</strong> ' + wallet.address + '</p>';
  html += '<p><strong>Balance:</strong> ' + wallet.balance + ' ETH</p>';
  html += '<p><strong>Type:</strong> ' + wallet.type.toUpperCase() + '</p>';
  html += '<p><strong>Created:</strong> ' + wallet.createdAt.toLocaleString() + '</p>';
  
  if (wallet.type === 'multisig') {
    html += '<p><strong>Required Signatures:</strong> ' + wallet.requiredSignatures + '/' + wallet.totalSigners + '</p>';
  }
  
  if (wallet.mnemonic) {
    html += '<p><strong>Mnemonic:</strong> <small>' + wallet.mnemonic + '</small></p>';
  }
  
  html += '<hr>';
  html += '<button class="btn btn-primary btn-sm" onclick="sendTransaction(\'' + address + '\')">Send Transaction</button> ';
  html += '<button class="btn btn-info btn-sm" onclick="exportWallet(\'' + address + '\')">Export</button> ';
  html += '<button class="btn btn-danger btn-sm" onclick="deleteWallet(\'' + address + '\')">Delete</button>';
  
  $('#wallet-details').html(html);
}

function generateMnemonic() {
  var words = ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident'];
  var mnemonic = [];
  for (var i = 0; i < 12; i++) {
    mnemonic.push(words[Math.floor(Math.random() * words.length)]);
  }
  return mnemonic.join(' ');
}

function sendTransaction(fromAddress) {
  var wallet = wallets[fromAddress];
  if (!wallet) {
    showNotification('Wallet not found');
    return;
  }
  
  // Create transaction form modal
  var modalHtml = '<div class="modal fade" id="sendTxModal" tabindex="-1">';
  modalHtml += '<div class="modal-dialog"><div class="modal-content">';
  modalHtml += '<div class="modal-header"><h4 class="modal-title">Send Transaction</h4>';
  modalHtml += '<button type="button" class="close" data-dismiss="modal">&times;</button></div>';
  modalHtml += '<div class="modal-body">';
  modalHtml += '<form id="send-tx-form">';
  modalHtml += '<div class="form-group">';
  modalHtml += '<label>From</label>';
  modalHtml += '<input type="text" class="form-control" value="' + wallet.name + ' (' + fromAddress.substring(0, 20) + '...)" readonly>';
  modalHtml += '</div>';
  modalHtml += '<div class="form-group">';
  modalHtml += '<label>To Address</label>';
  modalHtml += '<select class="form-control" id="tx-to-address">';
  modalHtml += '<option value="">Select recipient or enter address</option>';
  
  // Add other wallets as options
  Object.keys(wallets).forEach(function(addr) {
    if (addr !== fromAddress) {
      modalHtml += '<option value="' + addr + '">' + wallets[addr].name + ' (' + addr.substring(0, 20) + '...)</option>';
    }
  });
  
  modalHtml += '</select>';
  modalHtml += '</div>';
  modalHtml += '<div class="form-group">';
  modalHtml += '<label>Amount (ETH)</label>';
  modalHtml += '<input type="number" class="form-control" id="tx-amount" step="0.01" min="0.01" max="' + wallet.balance + '">';
  modalHtml += '</div>';
  modalHtml += '<div class="form-group">';
  modalHtml += '<label>Gas Price (Gwei)</label>';
  modalHtml += '<input type="number" class="form-control" id="tx-gas-price" value="20" min="1">';
  modalHtml += '</div>';
  modalHtml += '<div class="form-group">';
  modalHtml += '<label>Data (Optional)</label>';
  modalHtml += '<textarea class="form-control" id="tx-data" rows="3" placeholder="0x..."></textarea>';
  modalHtml += '</div>';
  modalHtml += '</form>';
  modalHtml += '</div>';
  modalHtml += '<div class="modal-footer">';
  modalHtml += '<button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>';
  modalHtml += '<button type="button" class="btn btn-primary" onclick="executeSendTransaction(\'' + fromAddress + '\')">Send Transaction</button>';
  modalHtml += '</div>';
  modalHtml += '</div></div></div>';
  
  // Remove existing modal and add new one
  $('#sendTxModal').remove();
  $('body').append(modalHtml);
  $('#sendTxModal').modal('show');
}

function executeSendTransaction(fromAddress) {
  var toAddress = $('#tx-to-address').val();
  var amount = parseFloat($('#tx-amount').val());
  var gasPrice = parseInt($('#tx-gas-price').val());
  var data = $('#tx-data').val().trim();
  
  if (!toAddress || !amount || amount <= 0) {
    showNotification('Please fill in all required fields');
    return;
  }
  
  var fromWallet = wallets[fromAddress];
  var toWallet = wallets[toAddress];
  
  if (amount > fromWallet.balance) {
    showNotification('Insufficient balance');
    return;
  }
  
  // Create transaction
  var txHash = '0x' + CryptoJS.SHA256(fromAddress + toAddress + amount + Date.now()).toString();
  var transaction = {
    hash: txHash,
    from: fromAddress,
    to: toAddress,
    value: amount,
    gasPrice: gasPrice * 1000000000, // Convert to wei
    gasUsed: 21000,
    data: data,
    timestamp: new Date(),
    status: 'Pending'
  };
  
  // Update balances
  fromWallet.balance -= amount;
  fromWallet.balance -= 0.00042; // Gas fee (21000 * 20 gwei)
  
  if (toWallet) {
    toWallet.balance += amount;
  }
  
  // Add to transaction history
  transactionHistory.unshift(transaction);
  
  // Update UI
  updateWalletList();
  updateTransactionHistory();
  
  // Close modal
  $('#sendTxModal').modal('hide');
  
  // Simulate transaction confirmation after 3 seconds
  setTimeout(function() {
    transaction.status = 'Success';
    updateTransactionHistory();
    showNotification('Transaction confirmed: ' + txHash.substring(0, 20) + '...');
  }, 3000);
  
  showNotification('Transaction sent: ' + txHash.substring(0, 20) + '...');
}

function updateTransactionHistory() {
  var html = '';
  
  if (transactionHistory.length === 0) {
    html = '<tr><td colspan="6" class="text-center text-muted">No transactions yet</td></tr>';
  } else {
    transactionHistory.slice(0, 20).forEach(function(tx) {
      var fromWallet = wallets[tx.from];
      var toWallet = wallets[tx.to];
      
      html += '<tr>';
      html += '<td><code>' + tx.hash.substring(0, 20) + '...</code></td>';
      html += '<td>' + (fromWallet ? fromWallet.name : tx.from.substring(0, 10) + '...') + '</td>';
      html += '<td>' + (toWallet ? toWallet.name : tx.to.substring(0, 10) + '...') + '</td>';
      html += '<td>' + tx.value + ' ETH</td>';
      html += '<td><span class="label label-' + (tx.status === 'Success' ? 'success' : tx.status === 'Pending' ? 'warning' : 'danger') + '">' + tx.status + '</span></td>';
      html += '<td>' + tx.timestamp.toLocaleString() + '</td>';
      html += '</tr>';
    });
  }
  
  $('#transaction-history tbody').html(html);
}

function exportWallet(address) {
  var wallet = wallets[address];
  var exportData = {
    name: wallet.name,
    address: wallet.address,
    publicKey: wallet.publicKey,
    type: wallet.type
  };
  
  // Don't export private key for security
  var blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = wallet.name.replace(/\s+/g, '_') + '_wallet.json';
  a.click();
  
  showNotification('Wallet exported (without private key)');
}

function deleteWallet(address) {
  if (confirm('Are you sure you want to delete this wallet?')) {
    delete wallets[address];
    updateWalletList();
    $('#wallet-details').html('<p class="text-muted">Select a wallet to view details</p>');
    showNotification('Wallet deleted');
  }
}

/////////////////////////
// Block Explorer functionality
/////////////////////////

var explorerBlocks = [];
var explorerTransactions = [];
var explorerAddresses = {};

function initializeBlockExplorer() {
  $('#search-btn').click(performSearch);
  $('#search-input').keypress(function(e) {
    if (e.which === 13) performSearch();
  });
  
  $('#view-blocks').click(function() {
    $('.btn-group .btn').removeClass('active');
    $(this).addClass('active');
    $('#explorer-title').text('Latest Blocks');
    showBlocksView();
  });
  
  $('#view-transactions').click(function() {
    $('.btn-group .btn').removeClass('active');
    $(this).addClass('active');
    $('#explorer-title').text('Recent Transactions');
    showTransactionsView();
  });
  
  $('#view-addresses').click(function() {
    $('.btn-group .btn').removeClass('active');
    $(this).addClass('active');
    $('#explorer-title').text('Address Explorer');
    showAddressesView();
  });
  
  // Generate sample data
  generateSampleExplorerData();
  showBlocksView();
  updateNetworkStats();
  updateRecentActivity();
  updateTopAddresses();
}

function generateSampleExplorerData() {
  // Generate sample blocks
  for (var i = 1; i <= 10; i++) {
    var blockHash = '0x' + CryptoJS.SHA256('block' + i + Date.now()).toString().substring(0, 64);
    var minerAddress = '0x' + CryptoJS.SHA256('miner' + i).toString().substring(0, 40);
    
    var block = {
      number: i,
      hash: blockHash,
      timestamp: new Date(Date.now() - (10 - i) * 60000), // 1 minute intervals
      transactions: Math.floor(Math.random() * 20) + 1,
      miner: minerAddress,
      size: Math.floor(Math.random() * 50000) + 10000,
      gasUsed: Math.floor(Math.random() * 8000000) + 1000000,
      gasLimit: 8000000,
      difficulty: 1234567 + i * 1000
    };
    
    explorerBlocks.push(block);
    
    // Generate transactions for this block
    for (var j = 0; j < block.transactions; j++) {
      var txHash = '0x' + CryptoJS.SHA256('tx' + i + j + Date.now()).toString().substring(0, 64);
      var fromAddress = '0x' + CryptoJS.SHA256('from' + i + j).toString().substring(0, 40);
      var toAddress = '0x' + CryptoJS.SHA256('to' + i + j).toString().substring(0, 40);
      
      var transaction = {
        hash: txHash,
        blockNumber: i,
        blockHash: blockHash,
        from: fromAddress,
        to: toAddress,
        value: Math.floor(Math.random() * 1000) / 100,
        gasPrice: 20000000000,
        gasUsed: Math.floor(Math.random() * 21000) + 21000,
        timestamp: block.timestamp,
        status: Math.random() > 0.1 ? 'Success' : 'Failed'
      };
      
      explorerTransactions.push(transaction);
      
      // Track addresses
      if (!explorerAddresses[fromAddress]) {
        explorerAddresses[fromAddress] = {
          address: fromAddress,
          balance: Math.floor(Math.random() * 10000) / 100,
          transactionCount: 0,
          firstSeen: transaction.timestamp
        };
      }
      explorerAddresses[fromAddress].transactionCount++;
      
      if (!explorerAddresses[toAddress]) {
        explorerAddresses[toAddress] = {
          address: toAddress,
          balance: Math.floor(Math.random() * 10000) / 100,
          transactionCount: 0,
          firstSeen: transaction.timestamp
        };
      }
      explorerAddresses[toAddress].transactionCount++;
    }
  }
}

function performSearch() {
  var query = $('#search-input').val().trim();
  if (!query) {
    showNotification('Please enter a search term');
    return;
  }
  
  // Search in blocks
  var foundBlock = explorerBlocks.find(function(block) {
    return block.hash.toLowerCase().includes(query.toLowerCase()) || 
           block.number.toString() === query;
  });
  
  if (foundBlock) {
    showBlockDetails(foundBlock);
    return;
  }
  
  // Search in transactions
  var foundTx = explorerTransactions.find(function(tx) {
    return tx.hash.toLowerCase().includes(query.toLowerCase());
  });
  
  if (foundTx) {
    showTransactionDetails(foundTx);
    return;
  }
  
  // Search in addresses
  var foundAddress = explorerAddresses[query] || Object.keys(explorerAddresses).find(function(addr) {
    return addr.toLowerCase().includes(query.toLowerCase());
  });
  
  if (foundAddress) {
    showAddressDetails(typeof foundAddress === 'string' ? explorerAddresses[foundAddress] : foundAddress);
    return;
  }
  
  showNotification('No results found for: ' + query);
}

function showBlocksView() {
  var html = '<div class="table-responsive">';
  html += '<table class="table table-striped">';
  html += '<thead><tr><th>Block #</th><th>Hash</th><th>Timestamp</th><th>Transactions</th><th>Miner</th><th>Size</th></tr></thead>';
  html += '<tbody>';
  
  explorerBlocks.slice().reverse().forEach(function(block) {
    html += '<tr style="cursor: pointer;" onclick="showBlockDetails(' + JSON.stringify(block).replace(/"/g, '&quot;') + ')">';
    html += '<td>' + block.number + '</td>';
    html += '<td><code>' + block.hash.substring(0, 20) + '...</code></td>';
    html += '<td>' + block.timestamp.toLocaleString() + '</td>';
    html += '<td>' + block.transactions + '</td>';
    html += '<td><code>' + block.miner.substring(0, 10) + '...</code></td>';
    html += '<td>' + (block.size / 1000).toFixed(1) + ' KB</td>';
    html += '</tr>';
  });
  
  html += '</tbody></table></div>';
  $('#explorer-content').html(html);
}

function showTransactionsView() {
  var html = '<div class="table-responsive">';
  html += '<table class="table table-striped">';
  html += '<thead><tr><th>Hash</th><th>Block</th><th>From</th><th>To</th><th>Value</th><th>Status</th></tr></thead>';
  html += '<tbody>';
  
  explorerTransactions.slice().reverse().slice(0, 50).forEach(function(tx) {
    html += '<tr style="cursor: pointer;" onclick="showTransactionDetails(' + JSON.stringify(tx).replace(/"/g, '&quot;') + ')">';
    html += '<td><code>' + tx.hash.substring(0, 20) + '...</code></td>';
    html += '<td>' + tx.blockNumber + '</td>';
    html += '<td><code>' + tx.from.substring(0, 10) + '...</code></td>';
    html += '<td><code>' + tx.to.substring(0, 10) + '...</code></td>';
    html += '<td>' + tx.value + ' ETH</td>';
    html += '<td><span class="label label-' + (tx.status === 'Success' ? 'success' : 'danger') + '">' + tx.status + '</span></td>';
    html += '</tr>';
  });
  
  html += '</tbody></table></div>';
  $('#explorer-content').html(html);
}

function showAddressesView() {
  var addresses = Object.values(explorerAddresses).sort(function(a, b) {
    return b.balance - a.balance;
  });
  
  var html = '<div class="table-responsive">';
  html += '<table class="table table-striped">';
  html += '<thead><tr><th>Address</th><th>Balance</th><th>Transactions</th><th>First Seen</th></tr></thead>';
  html += '<tbody>';
  
  addresses.slice(0, 50).forEach(function(addr) {
    html += '<tr style="cursor: pointer;" onclick="showAddressDetails(' + JSON.stringify(addr).replace(/"/g, '&quot;') + ')">';
    html += '<td><code>' + addr.address.substring(0, 20) + '...</code></td>';
    html += '<td>' + addr.balance + ' ETH</td>';
    html += '<td>' + addr.transactionCount + '</td>';
    html += '<td>' + addr.firstSeen.toLocaleString() + '</td>';
    html += '</tr>';
  });
  
  html += '</tbody></table></div>';
  $('#explorer-content').html(html);
}

function showBlockDetails(block) {
  var html = '<h4>Block #' + block.number + '</h4>';
  html += '<table class="table table-bordered">';
  html += '<tr><td><strong>Hash</strong></td><td><code>' + block.hash + '</code></td></tr>';
  html += '<tr><td><strong>Timestamp</strong></td><td>' + block.timestamp.toLocaleString() + '</td></tr>';
  html += '<tr><td><strong>Transactions</strong></td><td>' + block.transactions + '</td></tr>';
  html += '<tr><td><strong>Miner</strong></td><td><code>' + block.miner + '</code></td></tr>';
  html += '<tr><td><strong>Size</strong></td><td>' + (block.size / 1000).toFixed(1) + ' KB</td></tr>';
  html += '<tr><td><strong>Gas Used</strong></td><td>' + block.gasUsed.toLocaleString() + ' / ' + block.gasLimit.toLocaleString() + '</td></tr>';
  html += '<tr><td><strong>Difficulty</strong></td><td>' + block.difficulty.toLocaleString() + '</td></tr>';
  html += '</table>';
  
  // Show transactions in this block
  var blockTxs = explorerTransactions.filter(function(tx) {
    return tx.blockNumber === block.number;
  });
  
  if (blockTxs.length > 0) {
    html += '<h5>Transactions (' + blockTxs.length + ')</h5>';
    html += '<div class="table-responsive">';
    html += '<table class="table table-sm">';
    html += '<thead><tr><th>Hash</th><th>From</th><th>To</th><th>Value</th><th>Status</th></tr></thead>';
    html += '<tbody>';
    
    blockTxs.forEach(function(tx) {
      html += '<tr>';
      html += '<td><code>' + tx.hash.substring(0, 15) + '...</code></td>';
      html += '<td><code>' + tx.from.substring(0, 10) + '...</code></td>';
      html += '<td><code>' + tx.to.substring(0, 10) + '...</code></td>';
      html += '<td>' + tx.value + ' ETH</td>';
      html += '<td><span class="label label-' + (tx.status === 'Success' ? 'success' : 'danger') + '">' + tx.status + '</span></td>';
      html += '</tr>';
    });
    
    html += '</tbody></table></div>';
  }
  
  $('#detail-title').text('Block Details');
  $('#detail-content').html(html);
  $('#detail-panel').show();
}

function showTransactionDetails(tx) {
  var html = '<h4>Transaction Details</h4>';
  html += '<table class="table table-bordered">';
  html += '<tr><td><strong>Hash</strong></td><td><code>' + tx.hash + '</code></td></tr>';
  html += '<tr><td><strong>Block Number</strong></td><td>' + tx.blockNumber + '</td></tr>';
  html += '<tr><td><strong>Block Hash</strong></td><td><code>' + tx.blockHash + '</code></td></tr>';
  html += '<tr><td><strong>From</strong></td><td><code>' + tx.from + '</code></td></tr>';
  html += '<tr><td><strong>To</strong></td><td><code>' + tx.to + '</code></td></tr>';
  html += '<tr><td><strong>Value</strong></td><td>' + tx.value + ' ETH</td></tr>';
  html += '<tr><td><strong>Gas Price</strong></td><td>' + (tx.gasPrice / 1000000000) + ' Gwei</td></tr>';
  html += '<tr><td><strong>Gas Used</strong></td><td>' + tx.gasUsed.toLocaleString() + '</td></tr>';
  html += '<tr><td><strong>Status</strong></td><td><span class="label label-' + (tx.status === 'Success' ? 'success' : 'danger') + '">' + tx.status + '</span></td></tr>';
  html += '<tr><td><strong>Timestamp</strong></td><td>' + tx.timestamp.toLocaleString() + '</td></tr>';
  html += '</table>';
  
  $('#detail-title').text('Transaction Details');
  $('#detail-content').html(html);
  $('#detail-panel').show();
}

function showAddressDetails(address) {
  var html = '<h4>Address Details</h4>';
  html += '<table class="table table-bordered">';
  html += '<tr><td><strong>Address</strong></td><td><code>' + address.address + '</code></td></tr>';
  html += '<tr><td><strong>Balance</strong></td><td>' + address.balance + ' ETH</td></tr>';
  html += '<tr><td><strong>Transaction Count</strong></td><td>' + address.transactionCount + '</td></tr>';
  html += '<tr><td><strong>First Seen</strong></td><td>' + address.firstSeen.toLocaleString() + '</td></tr>';
  html += '</table>';
  
  // Show transactions for this address
  var addressTxs = explorerTransactions.filter(function(tx) {
    return tx.from === address.address || tx.to === address.address;
  });
  
  if (addressTxs.length > 0) {
    html += '<h5>Recent Transactions (' + addressTxs.length + ')</h5>';
    html += '<div class="table-responsive">';
    html += '<table class="table table-sm">';
    html += '<thead><tr><th>Hash</th><th>Type</th><th>Counterparty</th><th>Value</th><th>Status</th></tr></thead>';
    html += '<tbody>';
    
    addressTxs.slice(0, 20).forEach(function(tx) {
      var isOutgoing = tx.from === address.address;
      var counterparty = isOutgoing ? tx.to : tx.from;
      
      html += '<tr>';
      html += '<td><code>' + tx.hash.substring(0, 15) + '...</code></td>';
      html += '<td><span class="label label-' + (isOutgoing ? 'warning' : 'info') + '">' + (isOutgoing ? 'OUT' : 'IN') + '</span></td>';
      html += '<td><code>' + counterparty.substring(0, 15) + '...</code></td>';
      html += '<td>' + (isOutgoing ? '-' : '+') + tx.value + ' ETH</td>';
      html += '<td><span class="label label-' + (tx.status === 'Success' ? 'success' : 'danger') + '">' + tx.status + '</span></td>';
      html += '</tr>';
    });
    
    html += '</tbody></table></div>';
  }
  
  $('#detail-title').text('Address Details');
  $('#detail-content').html(html);
  $('#detail-panel').show();
}

function updateNetworkStats() {
  $('#total-blocks').text(explorerBlocks.length);
  $('#total-transactions').text(explorerTransactions.length);
  $('#network-hashrate').text((Math.random() * 100 + 50).toFixed(1) + ' TH/s');
  $('#block-time').text((Math.random() * 5 + 12).toFixed(1) + 's');
  $('#difficulty').text((1234567 + Math.floor(Math.random() * 100000)).toLocaleString());
}

function updateRecentActivity() {
  var html = '';
  var recentTxs = explorerTransactions.slice().reverse().slice(0, 5);
  
  recentTxs.forEach(function(tx) {
    html += '<div class="activity-item" style="margin-bottom: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">';
    html += '<small><strong>Transaction</strong></small><br>';
    html += '<small><code>' + tx.hash.substring(0, 20) + '...</code></small><br>';
    html += '<small>' + tx.value + ' ETH • ' + tx.timestamp.toLocaleTimeString() + '</small>';
    html += '</div>';
  });
  
  $('#recent-activity').html(html);
}

function updateTopAddresses() {
  var topAddresses = Object.values(explorerAddresses)
    .sort(function(a, b) { return b.balance - a.balance; })
    .slice(0, 5);
  
  var html = '';
  topAddresses.forEach(function(addr, index) {
    html += '<div class="address-item" style="margin-bottom: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">';
    html += '<small><strong>#' + (index + 1) + '</strong></small><br>';
    html += '<small><code>' + addr.address.substring(0, 20) + '...</code></small><br>';
    html += '<small>' + addr.balance + ' ETH • ' + addr.transactionCount + ' txs</small>';
    html += '</div>';
  });
  
  $('#top-addresses').html(html);
}

/////////////////////////
// Network simulation functionality
/////////////////////////

var networkNodes = {};
var networkConnections = [];

function createNode(nodeId, x, y) {
  networkNodes[nodeId] = {
    id: nodeId,
    x: x,
    y: y,
    status: 'online',
    blockchain: [],
    peers: [],
    lastSeen: Date.now()
  };
  return networkNodes[nodeId];
}

function connectNodes(nodeId1, nodeId2) {
  var connection = {
    from: nodeId1,
    to: nodeId2,
    latency: Math.random() * 100 + 50, // 50-150ms latency
    status: 'active'
  };
  networkConnections.push(connection);
  
  // Add to peer lists
  if (networkNodes[nodeId1] && networkNodes[nodeId2]) {
    if (networkNodes[nodeId1].peers.indexOf(nodeId2) === -1) {
      networkNodes[nodeId1].peers.push(nodeId2);
    }
    if (networkNodes[nodeId2].peers.indexOf(nodeId1) === -1) {
      networkNodes[nodeId2].peers.push(nodeId1);
    }
  }
  
  return connection;
}

function simulateNetworkPropagation(sourceNodeId, data, callback) {
  var propagationDelay = 100; // Base delay in ms
  
  if (networkNodes[sourceNodeId]) {
    networkNodes[sourceNodeId].peers.forEach(function(peerId) {
      var connection = networkConnections.find(function(conn) {
        return (conn.from === sourceNodeId && conn.to === peerId) ||
               (conn.from === peerId && conn.to === sourceNodeId);
      });
      
      var delay = connection ? connection.latency : propagationDelay;
      
      setTimeout(function() {
        if (callback) {
          callback(peerId, data);
        }
      }, delay);
    });
  }
}

function updateNodeStatus(nodeId, status) {
  if (networkNodes[nodeId]) {
    networkNodes[nodeId].status = status;
    networkNodes[nodeId].lastSeen = Date.now();
    
    // Update UI if network visualization exists
    if ($('#node-' + nodeId).length > 0) {
      $('#node-' + nodeId).removeClass('node-online node-offline node-syncing')
                          .addClass('node-' + status);
    }
  }
}
