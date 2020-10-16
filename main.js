function baseLog(base, val) {
    return Math.log(val) / Math.log(base);
}

function selectRadioInRow(row) { // accepts row as (this) in <tr>
    var radio = document.getElementById(row.id).getElementsByTagName('input')[0];
    radio.checked = true;
    handleUnconfirmedTXsRadioChange(radio);
}

function httpGet(theUrl) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", theUrl, false);
    xmlHttp.send();
    return xmlHttp.responseText;
}


var BTCUSD = JSON.parse(httpGet('https://blockchain.info/ticker')).USD.last;
var error = 0;

var redeemAddr = "";
var redeemAddrData = "";

var TXs = "" // all address TXs
var unconfTXs = ""

var TXInfo = ""; // selected TX info
var spentOutputTX = ""; // hash of input TX that was spent
var spentOutputValue = ""; // amount received from output TX
var oldFee = ""; // in sat
var addrIDInTX = ""; //addr ID in old TX
var oldScript = "";
var TXToAdjust = ""; // hash of the TX being adjusted
var estimatedTxSize = 10; // <4:version><1:txInCount><1:txOutCount><4:nLockTime>
var newtx = "";

function fetchAddrData(address) {
    var Url = "https://api.blockcypher.com/v1/btc/main/addrs/" + address + "?limit=10";
    var addrData = httpGet(Url);
    return addrData;
}

function fetchRedeemAddrData() {
    redeemAddr = document.getElementById('redeemFrom').value;
    redeemAddrData = fetchAddrData(redeemAddr);
    return redeemAddrData;
}


function fetchTXs() {
    error = 0;
    newtx = "";
    newtx = coinjs.transaction();
    location.hash = "#home";
    document.getElementById('unconfirmedTXsTableDiv').innerHTML = ""; // clear divs
    document.getElementById('unconfirmedTXProperties').innerHTML = "";
    document.getElementById('addressAlertBox').innerHTML = "";
    document.getElementById('newTXDiv').setAttribute('style', 'display: none;');
    document.getElementById('newTransactionDiv').setAttribute('style', 'display: none;');
    document.getElementById('unconfirmedTXTableDiv').setAttribute('style', 'display: none;');
    document.getElementById('inputsTableBody').innerHTML = "";
    document.getElementById('outputsTableBody').innerHTML = "";
    document.getElementById('unconfirmedTXsTableDiv').setAttribute('style', '');


    redeemAddr = document.getElementById('redeemFrom').value;
    unconfTXs = JSON.parse(httpGet('https://blockstream.info/api/address/' + redeemAddr + '/txs/mempool'));


    if (unconfTXs.length !== 0) {
        document.getElementById('unconfirmedTXsTableDiv').innerHTML = '<h3>Unconfirmed transactions</h3><a href="https://explorer.btc21.org/address/' + redeemAddr + '">' + redeemAddr + '</a></code>';
        var tableInnerHTML = '<table class="table table-sm table-striped table-hover"><thead><tr><th><b>Transaction hash</b></th><th><b>Amount, BTC</b></th><th><b>Date & Time</b></th><th><b>Select</b></th></tr></thead><tbody>';

        for (var i = 0; i < unconfTXs.length; i++) {
            var amountSent = 0;
            var TXID = unconfTXs[i]['txid'];

            TXInfo = getTXInfo(TXID);
            amountSent = Number(TXInfo.total);
            var date = new Date(TXInfo.received);
            var stringDate = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();

            tableInnerHTML += '<tr id="' + TXID + '" onclick="selectRadioInRow(this);">';
            tableInnerHTML += '<td>' + unconfTXs[i]['txid'] + '</td>';
            tableInnerHTML += '<td>' + amountSent / 10 ** 8 + '</td>';
            tableInnerHTML += '<td>' + stringDate + '</td>';
            tableInnerHTML += '<td><input type="radio" id="' + TXID + '" value="' + TXID + '" name="unconfirmedTXsRadio" onchange="handleUnconfirmedTXsRadioChange(this);"></td>';
            tableInnerHTML += '</tr>';
        }

        tableInnerHTML += '</tbody></table>';
        document.getElementById('unconfirmedTXsTableDiv').innerHTML += tableInnerHTML;
    } else if (error != 1) {
        error = 1;
        document.getElementById('addressAlertBox').innerHTML = '<div class="alert alert-dismissible alert-danger"><button type="button" class="close" data-dismiss="alert">&times;</button><strong>Oh snap!</strong> All transactions of the provided address are confirmed and hence nonadjustable.</div>';
    }
}

function getTXInfo(hash) {
    var Url = "https://api.blockcypher.com/v1/btc/main/txs/" + hash;
    return JSON.parse(httpGet(Url));
}


function handleUnconfirmedTXsRadioChange(radio) {
    TXToAdjust = radio.value;
    TXToAdjustHEX = httpGet('https://blockstream.info/api/tx/' + TXToAdjust + '/hex');
    decodeTransactionScript(TXToAdjustHEX);

    TXInfo = getTXInfo(TXToAdjust);
    oldFee = Number(TXInfo.fees);
    spentOutputValue = Number(TXInfo.total);

    var unconfirmedTXProperties = document.getElementById('unconfirmedTXProperties');
    unconfirmedTXProperties.innerHTML = '<h3>Transaction info</h3> <a href="https://explorer.btc21.org/tx/' + TXToAdjust + '">' + TXToAdjust + '</a></code>';
    unconfirmedTXProperties.innerHTML += '<table id="unconfirmedTXPropertiesTable" class="table table-sm"><tbody><tr><td>Input addresses</td><td><ul><div id="inputsList"></div></ul></td></tr> <tr><td>Output addresses</td><td><ul><div id="outputsList"></div></ul></td></tr> <tr><td>Fee, BTC</td><td><div id="feeField"></div></td></tr> <tr><td>Fee per byte, sat</td><td><div id="feePerByteField"></div></td></tr> <tr><td>Priority <span data-toggle="tooltip" title="Probability that the transaction will be added to the next block. The lower the priority of this transaction, the more chances you have to outpace it.">?</span></td><td><div id="priorityField"></div></td></tr></tbody></table>'
    for (var i = 0; i < TXInfo.inputs.length; i++) {
        document.getElementById('inputsList').innerHTML += '<li><a href="https://explorer.btc21.org/address/' + TXInfo.inputs[i].addresses + '">' + TXInfo.inputs[i].addresses + '</a></li>';
    }
    for (var i = 0; i < TXInfo.outputs.length; i++) {
        document.getElementById('outputsList').innerHTML += '<li><a href="https://explorer.btc21.org/address/' + TXInfo.outputs[i].addresses + '">' + TXInfo.outputs[i].addresses + '</a></li>';
    }
    document.getElementById('feeField').innerHTML = oldFee / 10 ** 8;
    document.getElementById('lowFeeAlertBox-OldFeeField').innerHTML = Number(TXInfo.fees) / 10 ** 8;
    document.getElementById('feePerByteField').innerHTML = Math.round(Number(TXInfo.fees) / Number(TXInfo.size));
    document.getElementById('priorityField').innerHTML = TXInfo.preference;
    document.getElementById('newTXDiv').setAttribute('style', '');
    document.getElementById('unconfirmedTXTableDiv').setAttribute('style', '');

    document.getElementById('newFeeSlider').value = Math.round(baseLog(1.12, oldFee * 5)); // calculate range value from Fee*5
    handleRangeChange();
    document.getElementById('unconfirmedTXProperties').setAttribute('style', '');

    //newtx = coinjs.transaction(); // remove applied settings from previous transaction selections
}

function checkFee(newFee) {
    var newFee = newFee * 10 ** 8;
    if (newFee <= oldFee) {
        document.getElementById('lowFeeAlertBox').setAttribute('style', '');
    } else {
        document.getElementById('lowFeeAlertBox').setAttribute('style', 'display: none;');
    }
}

function navbarHashChange() {
    if (location.hash == "#about") {
        document.getElementById('aboutAnchorLi').classList.add('active');
        document.getElementById('homeAnchorLi').classList.remove('active');
        document.getElementById('donateAnchorLi').classList.remove('active');
        document.getElementById('resourcesAnchorLi').classList.remove('active');
    } else if (location.hash == "#donate"){
        document.getElementById('donateAnchorLi').classList.add('active');
        document.getElementById('homeAnchorLi').classList.remove('active');
        document.getElementById('aboutAnchorLi').classList.remove('active');
        document.getElementById('resourcesAnchorLi').classList.remove('active');
    } else if (location.hash == "#resources"){
        document.getElementById('donateAnchorLi').classList.remove('active');
        document.getElementById('homeAnchorLi').classList.remove('active');
        document.getElementById('aboutAnchorLi').classList.remove('active');
        document.getElementById('resourcesAnchorLi').classList.add('active');
    } else {
        document.getElementById('donateAnchorLi').classList.remove('active');
        document.getElementById('homeAnchorLi').classList.add('active');
        document.getElementById('aboutAnchorLi').classList.remove('active');
        document.getElementById('resourcesAnchorLi').classList.remove('active');
    }
}

function handleRangeChange() { // update fee
    var range = document.getElementById('newFeeSlider');
    var newFee = (1.12 ** Number(range.value) / 10 ** 8).toFixed(8); // 1.12^[1-150] = []
    document.getElementById('newFeeBTCField').value = newFee;
    document.getElementById('newFeeUSDField').value = (newFee * BTCUSD).toFixed(2);
    checkFee(newFee);
}

function onLoad() {
    document.getElementById("redeemFrom").autofocus;
    window.onhashchange = navbarHashChange;
    document.getElementById('newFeeSlider').oninput = handleRangeChange;
    navbarHashChange();
}

function genTX() {
    document.getElementById('transactionHexField').value = "";
    var newFee = Number(document.getElementById('newFeeBTCField').value);
    var amountToSend = spentOutputValue / 10 ** 8 - newFee;


    var a = document.getElementById('newRecipientAddress').value; // address
    var ad = coinjs.addressDecode(a);
    estimatedTxSize += (ad.version == coinjs.pub ? 34 : 32)
    newtx.addoutput(a, amountToSend * 1); //addr, amount


    document.getElementById('transactionHexField').value = newtx.serialize();
    document.getElementById('txSize').innerHTML = newtx.size();
    document.getElementById('newTransactionDiv').setAttribute('style', '');

    document.getElementById('unconfirmedTXsTableDiv').setAttribute('style', 'display: none;');
    document.getElementById('unconfirmedTXProperties').setAttribute('style', 'display: none;');
    document.getElementById('unconfirmedTXTableDiv').setAttribute('style', 'display: none;');
    document.getElementById('newTXDiv').setAttribute('style', 'display: none;');

    location.hash = "#doneTransaction";
}

function addInput(spentTX, indexInTX, currentScript) {
    newtx.lock_time = 0; //set lock time (to 0)

    seq = 0xffffffff - 2; // use RBF

    if (currentScript.match(/^76a914[0-9a-f]{40}88ac$/)) {
        estimatedTxSize += 147
    } else if (currentScript.match(/^5[1-9a-f](?:210[23][0-9a-f]{64}){1,15}5[1-9a-f]ae$/)) {
        // <74:persig <1:push><72:sig><1:sighash> ><34:perpubkey <1:push><33:pubkey> > <32:prevhash><4:index><4:nSequence><1:m><1:n><1:OP>
        var scriptSigSize = (parseInt(currentScript.slice(1, 2), 16) * 74) + (parseInt(currentScript.slice(-3, -2), 16) * 34) + 43
        // varint 2 bytes if scriptSig is > 252
        estimatedTxSize += scriptSigSize + (scriptSigSize > 252 ? 2 : 1)
    } else {
        // underestimating won't hurt. Just showing a warning window anyways.
        estimatedTxSize += 147
    }

    newtx.addinput(spentTX, indexInTX, currentScript, seq); // output tx, tx id number, tx script
}

function decodeTransactionScript(hexTX) {
    var tx = coinjs.transaction();
    var decode = tx.deserialize(hexTX);

    var h = '';
    $.each(decode.ins, function(i, o) {
        var s = decode.extractScriptKey(i);
        h += '<tr>';
        h += '<td><input class="form-control" type="text" value="' + o.outpoint.hash + '" readonly></td>';
        h += '<td class="col-xs-1">' + o.outpoint.index + '</td>';
        h += '<td class="col-xs-2"><input class="form-control" type="text" value="' + Crypto.util.bytesToHex(o.script.buffer) + '" readonly></td>';
        h += '</tr>';
        addInput(o.outpoint.hash, o.outpoint.index, Crypto.util.bytesToHex(o.script.buffer));
    });

    document.getElementById('inputsTableBody').innerHTML = h;


    h = '';
    $.each(decode.outs, function(i, o) {

        var addr = '';
        if (o.script.chunks.length == 5) {
            addr = coinjs.scripthash2address(Crypto.util.bytesToHex(o.script.chunks[2]));
        } else if ((o.script.chunks.length == 2) && o.script.chunks[0] == 0) {
            addr = coinjs.bech32_encode(coinjs.bech32.hrp, [coinjs.bech32.version].concat(coinjs.bech32_convert(o.script.chunks[1], 8, 5, true)));
        } else {
            var pub = coinjs.pub;
            coinjs.pub = coinjs.multisig;
            addr = coinjs.scripthash2address(Crypto.util.bytesToHex(o.script.chunks[1]));
            coinjs.pub = pub;
        }

        h += '<tr>';
        h += '<td><input class="form-control" type="text" value="' + addr + '" readonly></td>';
        h += '<td class="col-xs-1">' + (o.value / 100000000).toFixed(8) + '</td>';
        h += '</tr>';
    });
    document.getElementById('outputsTableBody').innerHTML = h;
}