async function testApi() {
  try {
    const res = await fetch("http://localhost:4000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@happybonding.in", password: "HappyBonding@2026" })
    });
    const login = await res.json();
    console.log("LOGIN:", login.token ? "Success" : "Failed");
    
    if (!login.token) return;

    const saleRes = await fetch("http://localhost:4000/api/sales", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${login.token}`,
        "x-branch-id": login.branchIds[0] 
      },
      body: JSON.stringify({
        idempotencyKey: "test-api-" + Date.now(),
        partyId: "cmsddihj10001w4ds5b07zbf4",
        invoiceDate: new Date().toISOString(),
        placeOfSupply: "33",
        paidAmount: 0,
        paymentMode: "Cash",
        lines: [
          {
            variantId: "cmsdd5qsv000aw4roxzf6ey05",
            quantity: 1,
            unitPrice: 100,
            discount: 0,
            taxRate: 5
          }
        ]
      })
    });
    
    const body = await saleRes.text();
    console.log("SALE STATUS:", saleRes.status);
    console.log("SALE RESPONSE:", body);
  } catch(e) {
    console.error(e);
  }
}
testApi();
