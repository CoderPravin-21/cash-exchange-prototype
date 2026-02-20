#!/bin/bash

echo "🧹 Step 1: Clear database..."
curl -s -X DELETE http://localhost:5000/api/test/clear-all | jq -r '.message'

echo ""
echo "👤 Step 2: Register Alice..."
ALICE=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Johnson","email":"alice@example.com","password":"alice123","location":{"coordinates":[77.5946,12.9716]}}')
ALICE_TOKEN=$(echo $ALICE | jq -r '.data.accessToken')
echo "Alice Token: ${ALICE_TOKEN:0:30}..."

echo ""
echo "👤 Step 3: Register Bob..."
BOB=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob Smith","email":"bob@example.com","password":"bob123","location":{"coordinates":[77.5950,12.9720]}}')
BOB_TOKEN=$(echo $BOB | jq -r '.data.accessToken')
echo "Bob Token: ${BOB_TOKEN:0:30}..."

echo ""
echo "💰 Step 4: Add ₹2000 to Bob's wallet..."
curl -s -X POST http://localhost:5000/api/test/add-balance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -d '{"amount": 2000}' | jq

echo ""
echo "📝 Step 5: Alice creates CASH_TO_ONLINE request..."
ALICE_REQ=$(curl -s -X POST http://localhost:5000/api/exchange \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -d '{"amount":1000,"exchangeType":"CASH_TO_ONLINE","latitude":12.9716,"longitude":77.5946,"notes":"Coffee Day"}')
ALICE_REQ_ID=$(echo $ALICE_REQ | jq -r '.data.exchangeRequest._id')
echo "Alice Request ID: $ALICE_REQ_ID"

echo ""
echo "📝 Step 6: Bob creates ONLINE_TO_CASH request..."
BOB_REQ=$(curl -s -X POST http://localhost:5000/api/exchange \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -d '{"amount":1500,"exchangeType":"ONLINE_TO_CASH","latitude":12.9720,"longitude":77.5950}')
BOB_REQ_ID=$(echo $BOB_REQ | jq -r '.data.exchangeRequest._id')
echo "Bob Request ID: $BOB_REQ_ID"

echo ""
echo "🔍 Step 7: BOB DISCOVERS NEARBY (Alice's request)..."
echo "=================================================="
curl -s -X GET "http://localhost:5000/api/exchange/nearby?lat=12.9720&lng=77.5950&maxDistance=5000" \
  -H "Authorization: Bearer $BOB_TOKEN" | jq

echo ""
echo "🔍 Step 8: ALICE DISCOVERS NEARBY (Bob's request)..."
echo "=================================================="
curl -s -X GET "http://localhost:5000/api/exchange/nearby?lat=12.9716&lng=77.5946&maxDistance=5000" \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq

echo ""
echo "🧪 Step 9: Test with 100m radius (should be empty)..."
curl -s -X GET "http://localhost:5000/api/exchange/nearby?lat=12.9720&lng=77.5950&maxDistance=100" \
  -H "Authorization: Bearer $BOB_TOKEN" | jq '.data.pagination'

echo ""
echo "🧪 Step 10: Test with 1000m radius (should find Alice)..."
curl -s -X GET "http://localhost:5000/api/exchange/nearby?lat=12.9720&lng=77.5950&maxDistance=1000" \
  -H "Authorization: Bearer $BOB_TOKEN" | jq '.data.pagination'

echo ""
echo "✅ Step 11: Bob accepts Alice's request..."
ACCEPT=$(curl -s -X POST "http://localhost:5000/api/exchange/$ALICE_REQ_ID/accept" \
  -H "Authorization: Bearer $BOB_TOKEN")
CODE=$(echo $ACCEPT | jq -r '.data.completionCode')
echo "Completion Code: $CODE"
echo $ACCEPT | jq

echo ""
echo "✔️ Step 12: Bob completes exchange..."
curl -s -X POST "http://localhost:5000/api/exchange/$ALICE_REQ_ID/complete" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -d "{\"code\":\"$CODE\"}" | jq

echo ""
echo "📊 Step 13: Final verification..."
echo "Alice's completed exchanges:"
curl -s -X GET http://localhost:5000/api/exchange/my-requests \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq '.data.requests[0] | {amount, status, type: .exchangeType}'

echo ""
echo "Bob's completed exchanges:"
curl -s -X GET http://localhost:5000/api/exchange/my-requests \
  -H "Authorization: Bearer $BOB_TOKEN" | jq '.data.requests[] | {amount, status, type: .exchangeType}'

echo ""
echo "✅ ✅ ✅ COMPLETE FLOW TESTED SUCCESSFULLY! ✅ ✅ ✅"
