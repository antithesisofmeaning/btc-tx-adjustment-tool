function json2table(json) {
        // EXTRACT VALUE FOR HTML HEADER. 
        // ('Book ID', 'Book Name', 'Category' and 'Price')
        var col = [];
        for (var i = 0; i < json.length; i++) {
            for (var key in json[i]) {
                if (col.indexOf(key) === -1) {
                		if (key == "tx_hash") {
                			col.push(key);
                		} else if (key == "value") {
                			col.push(key);
                		} else if (key == "received") {
                			col.push(key);
                		}
                }
            }
        }

        // CREATE DYNAMIC TABLE.
        var table = document.createElement("table");
        table.setAttribute('id', 'unconfirmedTXsTable');
        table.setAttribute('class', 'table table-sm');

        // CREATE HTML TABLE HEADER ROW USING THE EXTRACTED HEADERS ABOVE.

        var tr = table.insertRow(-1);                   // TABLE ROW.

        for (var i = 0; i < col.length+1; i++) {
            var th = document.createElement("th");      // TABLE HEADER.
            th.innerHTML = 'Select';
            if (col[i] == "tx_hash") {
            	th.innerHTML = "Transaction hash";
            } else if (col[i] == "value") {
            	th.innerHTML = "Amount, BTC";
            } else if (col[i] == "received") {
            	th.innerHTML = "Date & Time";
            }

            tr.appendChild(th);
        }

        // ADD JSON DATA TO THE TABLE AS ROWS.
        for (var i = 0; i < json.length; i++) {

            tr = table.insertRow(-1);
            tr.setAttribute('onclick', 'selectRadioInRow(this);');
            tr.setAttribute('id', 'tr-'+json[i]["tx_hash"]+'-'+json[i]["spent_by"]);

            for (var j = 0; j < col.length+1; j++) {
                if (json[i]["tx_hash"] != "undefined"){
                    var tabCell = tr.insertCell(-1);
                    tabCell.innerHTML = '<div class="radio"><label><input type="radio" id="'+json[i]["tx_hash"]+'-'+json[i]["spent_by"]+'" value="'+json[i]["tx_hash"]+'-'+json[i]["spent_by"]+'" name="unconfirmedTXsRadio" onchange="handleUnconfirmedTXsRadioChange(this);"></label></div>';
                    console.log(json[i]["value"]);
                    console.log(json[i]["tx_output_n"]);
                    console.log(json[i]["tx_hash"]);
                    if (col[j] == "value") {
                    	tabCell.innerHTML = Number(json[i][col[j]]) / 10**8;
                	} else if (col[j] == "received") {
                		date = new Date(json[i][col[j]]);
                		var stringDate = date.getFullYear()+'-' + (date.getMonth()+1) + '-'+date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
                		tabCell.innerHTML = stringDate;
                	} else if (col[j] == "tx_hash") {
                		tabCell.innerHTML = json[i][col[j]];
                	}
                }
            }
        }

        return table
    }


function selectRadioInRow(row) { // accepts row as (this) in <tr>
    var radio = document.getElementById(row.id).getElementsByTagName('input')[0];
    radio.checked = true;
    handleUnconfirmedTXsRadioChange(radio);
}

function httpGet(theUrl) {
	console.log('* Making request')
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", theUrl, false);
    xmlHttp.send();
    return xmlHttp.responseText;
}


var BTCUSD = JSON.parse(httpGet('https://blockchain.info/ticker')).USD.last;

var error = 0;


function fetchAddrData(address){
	console.log('* Fetching address data');
	var Url="https://api.blockcypher.com/v1/btc/main/addrs/"+address+"?limit=10";
	var addrData = httpGet(Url);
	return addrData;
}

var redeemAddr = "";
var redeemAddrData = "";

function fetchRedeemAddrData(){
	console.log('* Fetching redeem address data');
	redeemAddr = document.getElementById('redeemFrom').value;
	redeemAddrData = fetchAddrData(redeemAddr);
	return redeemAddrData;

}

var TXs = "" // all address TXs
var unconfTXs = ""

function fetchTXs(){
	console.log('* Fetching transactions');
	error = 0;
	document.getElementById('unconfirmedTXsTableDiv').innerHTML = ""; // clear divs
	document.getElementById('unconfirmedTXProperties').innerHTML = "";
	document.getElementById('addressAlertBox').innerHTML = "";
    document.getElementById('newTXDiv').setAttribute('style', 'display: none;');
    document.getElementById('newTransactionDiv').setAttribute('style', 'display: none;');

	TXs = JSON.parse(fetchRedeemAddrData());
	unconfTXs = TXs.unconfirmed_txrefs;

	if (typeof unconfTXs !== 'undefined') {
		document.getElementById('unconfirmedTXsTableDiv').innerHTML = '<h3>Unconfirmed transactions</h3><h5><a href="https://explorer.btc21.org/address/' + document.getElementById('redeemFrom').value + '">' + document.getElementById('redeemFrom').value + '</a></code></h5>';
		document.getElementById('unconfirmedTXsTableDiv').appendChild(json2table(unconfTXs));
		//console.log(unconfTXs)
	} else if (error != 1) {
		error = 1;
		console.log('*** Alert: All transactions are confirmed');
		document.getElementById('addressAlertBox').innerHTML = '<div class="alert alert-dismissible alert-danger"><button type="button" class="close" data-dismiss="alert">&times;</button><strong>Oh snap!</strong> All transactions of the provided address are confirmed and hence nonadjustable.</div>';
	}
}

function getTXInfo(hash) {
	var Url = "https://api.blockcypher.com/v1/btc/main/txs/"+hash;
	return JSON.parse(httpGet(Url));
}

var TXInfo = ""; // selected TX info
var spentOutputTX = ""; // hash of input TX that was spent
var spentOutputValue = ""; // amount received from output TX
var oldFee = ""; // in sat
var addrIDInTX = ""; //addr ID in old TX
var oldScript = "";
var TXToAdjust = ""; // hash of the TX being adjusted

function handleUnconfirmedTXsRadioChange(radio) {
    TXToAdjust = radio.value.split("-")[0];
    spentOutputTX = radio.value.split("-")[1];
    //addrIDInTX = Number(radio.value.split("-")[2]);
    //spentOutputValue = Number(radio.value.split("-")[3]) / 10**8;
	TXInfo = getTXInfo(TXToAdjust);
    spentOutputTXInfo = getTXInfo(spentOutputTX);
    oldFee = TXInfo.fees;
    //console.log(JSON.stringify(spentOutputTXInfo));

    var redeemAddrDataJson = JSON.parse(redeemAddrData);
    addrIDInTX = redeemAddrDataJson.txrefs[0].tx_output_n;

    oldScript = spentOutputTXInfo.outputs[addrIDInTX].script;
    spentOutputValue = spentOutputTXInfo.outputs[addrIDInTX].value / 10**8;
    console.log('script: ' + oldScript);
	
    var unconfirmedTXProperties = document.getElementById('unconfirmedTXProperties');
	unconfirmedTXProperties.innerHTML = '<h3>Transaction info</h3> <h5><a href="https://explorer.btc21.org/tx/' + TXToAdjust + '">' + TXToAdjust + '</a></code></h5>';
	unconfirmedTXProperties.innerHTML += '<table id="unconfirmedTXPropertiesTable" class="table table-sm"><tbody><tr><td>Input(s)</td><td><ul><div id="inputsList"></div></ul></td></tr> <tr><td>Output(s)</td><td><ul><div id="outputsList"></div></ul></td></tr> <tr><td>Spent output</td><td><div id="spentOutputField"></div></td></tr> <tr><td>Fee, BTC</td><td><div id="feeField"></div></td></tr> <tr><td>Fee per byte, sat</td><td><div id="feePerByteField"></div></td></tr> <tr><td>Priority <span data-toggle="tooltip" title="Probability that the transaction will be added to the next block.">?</span></td><td><div id="priorityField"></div></td></tr></tbody></table>'
	for (var i = 0; i < TXInfo.inputs.length; i++){
		document.getElementById('inputsList').innerHTML += '<li><a href="https://explorer.btc21.org/address/' + TXInfo.inputs[i].addresses + '">' + TXInfo.inputs[i].addresses + '</a></li>';
	}
	for (var i = 0; i < TXInfo.outputs.length; i++){
		document.getElementById('outputsList').innerHTML += '<li><a href="https://explorer.btc21.org/address/' + TXInfo.outputs[i].addresses + '">' + TXInfo.outputs[i].addresses + '</a></li>';
	}
    document.getElementById('spentOutputField').innerHTML = '<a href="https://explorer.btc21.org/tx/' + spentOutputTX + '">' + spentOutputTX + '</a>';
	document.getElementById('feeField').innerHTML = Number(TXInfo.fees) / 10**8;
    document.getElementById('lowFeeAlertBox-OldFeeField').innerHTML = Number(TXInfo.fees) / 10**8;
    document.getElementById('feePerByteField').innerHTML = Math.round(Number(TXInfo.fees) / Number(TXInfo.size));
	document.getElementById('priorityField').innerHTML = TXInfo.preference;
	//console.log(TXInfo);
    document.getElementById('newTXDiv').setAttribute('style', '');

}

function checkFee(newFee){
    var newFee = newFee * 10**8;
    if (newFee <= oldFee){
        document.getElementById('lowFeeAlertBox').setAttribute('style', '');
    } else {
        document.getElementById('lowFeeAlertBox').setAttribute('style', 'display: none;');
    }
}

function navbarHashChange(){
        if (location.hash == "#about") {
            document.getElementById('aboutAnchorLi').classList.add('active');
            document.getElementById('homeAnchorLi').classList.remove('active');
        } else {
            document.getElementById('aboutAnchorLi').classList.remove('active');
            document.getElementById('homeAnchorLi').classList.add('active');
        }
    }

function onLoad(){
    window.onhashchange = navbarHashChange;
    document.getElementById('newFeeSlider').oninput = function() { // update fee
        var newFee = (1.12 ** Number(this.value) / 10**8).toFixed(8); // 1.12^[1-150] = []
        document.getElementById('newFeeBTCField').value = newFee;
        document.getElementById('newFeeUSDField').value = (newFee * BTCUSD).toFixed(2);
        checkFee(newFee);
    }

    navbarHashChange();
}

function genTX(){

    var newFee = document.getElementById('newFeeBTCField').value;
    var amountToSend = spentOutputValue - newFee;
    var tx = coinjs.transaction();
    var estimatedTxSize = 10; // <4:version><1:txInCount><1:txOutCount><4:nLockTime>

    tx.lock_time = 0; //set lock time (to 0)
        
    seq = 0xffffffff-2; // use RBF

    var currentScript = oldScript; // script

    if (currentScript.match(/^76a914[0-9a-f]{40}88ac$/)) {
        estimatedTxSize += 147
    } else if (currentScript.match(/^5[1-9a-f](?:210[23][0-9a-f]{64}){1,15}5[1-9a-f]ae$/)) {
        // <74:persig <1:push><72:sig><1:sighash> ><34:perpubkey <1:push><33:pubkey> > <32:prevhash><4:index><4:nSequence><1:m><1:n><1:OP>
        var scriptSigSize = (parseInt(currentScript.slice(1,2),16) * 74) + (parseInt(currentScript.slice(-3,-2),16) * 34) + 43
        // varint 2 bytes if scriptSig is > 252
        estimatedTxSize += scriptSigSize + (scriptSigSize > 252 ? 2 : 1)
    } else {
        // underestimating won't hurt. Just showing a warning window anyways.
        estimatedTxSize += 147
    }

    tx.addinput(spentOutputTX, addrIDInTX, currentScript, seq); // output tx, tx id number, tx script


    var a = document.getElementById('newRecipientAddress').value; // address
    var ad = coinjs.addressDecode(a);
        estimatedTxSize += (ad.version == coinjs.pub ? 34 : 32)
        tx.addoutput(a, amountToSend); //addr, amount


    document.getElementById('transactionHexField').value = tx.serialize();
    document.getElementById('txSize').innerHTML = (tx.size());
    document.getElementById('newTransactionDiv').setAttribute('style', '');
    window.location.hash = '#doneTransaction';
}