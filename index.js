import express from "express";
import xrpl from "xrpl";
import crypto from "crypto-browserify";
import * as cc from "five-bells-condition";
import cors from "cors";

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// For createEscrow
app.post("/createEscrow", async (req, res) => {
  try {
    // Create a connection to the Ripple testnet
    const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
    await client.connect();

    const senderWallet = xrpl.Wallet.fromSeed(process.env["MY_SEED"]);

    const preimageData = crypto.randomBytes(32);
    const fulfillment = new cc.PreimageSha256();
    fulfillment.setPreimage(preimageData);

    const condition = fulfillment
      .getConditionBinary()
      .toString("hex")
      .toUpperCase();

    // Keep secret until you want to finish the escrow
    const fulfillment_hex = fulfillment
      .serializeBinary()
      .toString("hex")
      .toUpperCase();

    // Show Cancel after time

    const rippleOffset = 946684800;
    const CancelAfter =
      Math.floor(Date.now() / 1000) + 24 * 60 * 60 - rippleOffset;

    // Prepare the payment transaction
    const prepared = await client.autofill({
      TransactionType: "EscrowCreate",
      CancelAfter: CancelAfter,
      Condition: condition,
      Account: senderWallet.classicAddress,
      Amount: req.body.amount, // Use the received amount here
      Destination: req.body.destination, // Recipient
    });

    // Sign the prepared transaction
    const signed = senderWallet.sign(prepared);
    console.log("SIGNED", signed);

    // Submit the signed transaction and wait for confirmation
    const transaction = await client.submitAndWait(signed.tx_blob);

    console.log("PREPARED", transaction);

    res.json({
      transaction: transaction,
      fulfillment: fulfillment_hex,
    });
  } catch (error) {
    res.status(500).json({ error: "Error creating escrow" });
  }
});

// For finishEscrow
app.post("/finishEscrow", async (req, res) => {
  try {
    // Create a connection to the Ripple testnet
    const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
    await client.connect();
    // Receive data from the request body

    const senderWallet = xrpl.Wallet.fromSeed(process.env["MY_SEED"]);

    const { condition, fulfillment, OfferSequence } = req.body;

    // Prepare the finish transaction
    const prepared = await client.autofill({
      TransactionType: "EscrowFinish",
      Account: senderWallet.classicAddress,
      Condition: condition,
      Fulfillment: fulfillment,
      Owner: senderWallet.classicAddress,
      OfferSequence: OfferSequence,
    });
    const signed = senderWallet.sign(prepared);

    // Submit the signed transaction and wait for confirmation
    const transaction = await client.submitAndWait(signed.tx_blob);

    res.json({ transaction });
  } catch (error) {
    res.status(500).json({ error: "Error finishing escrow" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
