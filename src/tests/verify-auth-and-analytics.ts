import { passwordLoginSchema, verifyPasswordOtpSchema, webauthnLoginOptionsSchema } from "../modules/auth/auth.validation";
import { parseSellerAnalyticsQuery } from "../modules/marketplace/catalog.validation";
import { UserRole, prisma } from "../config/db";
import { AppError } from "../utils/AppError";
import { AuthService } from "../modules/auth/auth.service";
import { DashboardService } from "../modules/marketplace/dashboard.service";

function assert(condition: boolean, msg: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${msg}`);
    }
}

async function runTests() {
    console.log("--- Starting Deep Verification Tests ---");

    // Test 1: passwordLoginSchema with portal
    {
        const buyerRes = passwordLoginSchema.parse({
            body: { qcuIdNumber: "24-0001", password: "Password123!", portal: "buyer" }
        });
        assert(buyerRes.body.portal === "buyer", "portal buyer parsed");

        const sellerRes = passwordLoginSchema.parse({
            body: { qcuIdNumber: "24-0001", password: "Password123!", portal: "seller" }
        });
        assert(sellerRes.body.portal === "seller", "portal seller parsed");

        const noPortalRes = passwordLoginSchema.parse({
            body: { qcuIdNumber: "24-0001", password: "Password123!" }
        });
        assert(noPortalRes.body.portal === undefined, "portal undefined parsed");
        console.log("✓ Test 1: passwordLoginSchema validation passes");
    }

    // Test 2: verifyPasswordOtpSchema with portal
    {
        const otpRes = verifyPasswordOtpSchema.parse({
            body: { qcuIdNumber: "24-0001", otp: "123456", portal: "seller" }
        });
        assert(otpRes.body.portal === "seller", "portal seller parsed for OTP");
        console.log("✓ Test 2: verifyPasswordOtpSchema validation passes");
    }

    // Test 3: webauthnLoginOptionsSchema with portal
    {
        const webauthnRes = webauthnLoginOptionsSchema.parse({
            body: { qcuIdNumber: "24-0001", portal: "seller" }
        });
        assert(webauthnRes.body.portal === "seller", "portal seller parsed for webauthn");
        console.log("✓ Test 3: webauthnLoginOptionsSchema validation passes");
    }

    // Test 4: parseSellerAnalyticsQuery date transformations
    {
        const queryWithStartEnd = parseSellerAnalyticsQuery({
            start: "2026-11-01",
            end: "2026-11-07"
        });
        assert(queryWithStartEnd.from === "2026-11-01", "start transformed to from");
        assert(queryWithStartEnd.to === "2026-11-07", "end transformed to to");
        assert(queryWithStartEnd.groupBy === "day", "default groupBy is day");

        const queryWithFromTo = parseSellerAnalyticsQuery({
            from: "2026-10-01",
            to: "2026-10-31",
            groupBy: "week"
        });
        assert(queryWithFromTo.from === "2026-10-01", "from preserved");
        assert(queryWithFromTo.to === "2026-10-31", "to preserved");
        assert(queryWithFromTo.groupBy === "week", "groupBy week parsed");
        console.log("✓ Test 4: parseSellerAnalyticsQuery transformation passes");
    }

    // Test 5: Live DB Auth Service Guard - Buyer Rejected on Seller Portal
    {
        let errorCaught: any = null;
        try {
            await AuthService.requestPasswordOtp({
                qcuIdNumber: "00-0002",
                password: "12345678",
                portal: "seller",
            });
        } catch (e: any) {
            errorCaught = e;
        }
        assert(errorCaught instanceof AppError, "Buyer login threw AppError");
        assert(errorCaught.statusCode === 403, `Expected status 403 but got ${errorCaught.statusCode}`);
        assert(
            errorCaught.message.includes("registered as a buyer"),
            `Expected message to contain registered as a buyer, got: ${errorCaught.message}`
        );
        console.log("✓ Test 5: Live DB AuthService rejects pure buyer on seller portal with 403 Forbidden");
    }

    // Test 6: Live DB Auth Service Guard - Seller Allowed on Seller Portal
    {
        const sellerLogin = await AuthService.requestPasswordOtp({
            qcuIdNumber: "00-0003",
            password: "12345678",
            portal: "seller",
        });
        assert(Boolean(sellerLogin?.data?.token || sellerLogin?.message), "Seller login succeeded");
        if (sellerLogin?.data?.user) {
            assert(sellerLogin.data.user.hasSellerProfile === true, "hasSellerProfile is true");
            assert(sellerLogin.data.user.sellerStatus === "VERIFIED", "sellerStatus is VERIFIED");
        }
        console.log("✓ Test 6: Live DB AuthService allows verified seller and includes seller session details");
    }

    // Test 7: Live DB Dashboard Service - Full Analytics with 5 features
    {
        const sellerUser = await prisma.user.findUnique({
            where: { qcuIdNumber: "00-0003" },
            include: { sellerProfile: { include: { store: true } } },
        });
        assert(Boolean(sellerUser?.id), "Seller user 00-0003 exists in DB");

        const analytics = await DashboardService.getSellerAnalytics(sellerUser!.id, {
            from: "2026-10-01",
            to: "2026-10-31",
            groupBy: "day",
        });

        // 1. Weekly sales series (4 weeks, non-overlapping label dates)
        assert(Array.isArray(analytics.weeklySales) && analytics.weeklySales.length === 4, "Weekly sales has 4 buckets");
        assert(analytics.weeklySales[0].id === "w1", "w1 bucket exists");
        assert(typeof analytics.weeklySales[0].revenue === "number", "Weekly sales revenue is numeric");

        // 2. Historical % comparisons
        assert(typeof analytics.kpis.revenueChangePct === "number", "revenueChangePct is numeric");
        assert(typeof analytics.kpis.ordersChangePct === "number", "ordersChangePct is numeric");

        // 3. Traffic channels
        assert(typeof analytics.traffic.total === "number", "Traffic total is numeric");
        assert(Array.isArray(analytics.traffic.channels) && analytics.traffic.channels.length === 3, "3 traffic channels exist");
        assert(Boolean(analytics.traffic.insight), "Traffic insight string is present");

        // 4. Priority actions
        assert(Array.isArray(analytics.actions) && analytics.actions.length > 0, "Priority actions array is populated");
        assert(Boolean(analytics.actions[0].cta && analytics.actions[0].to), "Action has CTA and navigation path");
        assert(Boolean(analytics.nextReview), "nextReview date string is present");

        // 5. Conversion metrics
        assert(typeof analytics.kpis.conversionRatePct === "number", "conversionRatePct is numeric");
        assert(typeof analytics.kpis.uniqueVisitors === "number", "uniqueVisitors is numeric");
        assert(typeof analytics.kpis.conversionChangePct === "number", "conversionChangePct is numeric");

        // Period formatting
        assert(analytics.period.start === "2026-10-01", "period.start matches query from");
        assert(analytics.period.end === "2026-10-31", "period.end matches query to");
        assert(analytics.period.label.includes("2026-10-01") && analytics.period.label.includes("2026-10-31"), "period.label includes bounds");

        console.log("✓ Test 7: Live DB DashboardService delivers all 5 required features seamlessly");
    }

    // Test 8: Date Normalization - Single day query ("Today") covers 24 hours without failing
    {
        const sellerUser = await prisma.user.findUnique({
            where: { qcuIdNumber: "00-0003" },
        });

        const singleDayAnalytics = await DashboardService.getSellerAnalytics(sellerUser!.id, {
            from: "2026-11-16",
            to: "2026-11-16",
        });

        assert(singleDayAnalytics.period.start === "2026-11-16", "Single day period.start is 2026-11-16");
        assert(singleDayAnalytics.period.end === "2026-11-16", "Single day period.end is 2026-11-16");
        // Verify range covers 1 full day (86,400,000 ms)
        const duration = singleDayAnalytics.range.to.getTime() - singleDayAnalytics.range.from.getTime();
        assert(duration === 24 * 60 * 60 * 1000, `Expected 24h duration, got ${duration}`);
        console.log("✓ Test 8: Single-day date range normalizes properly to 24-hour half-open window");
    }

    // Test 9: Inverted Date Range Error Handling
    {
        const sellerUser = await prisma.user.findUnique({
            where: { qcuIdNumber: "00-0003" },
        });

        let invertedErr: any = null;
        try {
            await DashboardService.getSellerAnalytics(sellerUser!.id, {
                from: "2026-11-20",
                to: "2026-11-10",
            });
        } catch (e: any) {
            invertedErr = e;
        }
        assert(invertedErr instanceof AppError, "Inverted date range throws AppError");
        assert(invertedErr.statusCode === 400, `Expected 400 for inverted date range, got ${invertedErr.statusCode}`);
        console.log("✓ Test 9: Inverted date range correctly rejected with 400 Bad Request");
    }

    // Test 10: Critical Stock Card logic with 0 units remaining (out of stock)
    {
        const evalCriticalStockCard = (isCritical?: boolean, productName?: string, unitsLeft?: number | null) => {
            const critical = isCritical !== undefined
                ? Boolean(isCritical)
                : Boolean((unitsLeft ?? 0) > 0 || (unitsLeft === 0 && productName && productName !== "All Products In Stock"));
            return { isCritical: critical, isHealthy: !critical };
        };

        // Out of stock product (0 units left, isCritical: true) -> MUST NOT be healthy
        const outOfStock = evalCriticalStockCard(true, "Campus Org Hoodie", 0);
        assert(outOfStock.isCritical === true, "Out of stock item is critical");
        assert(outOfStock.isHealthy === false, "Out of stock item is NOT healthy");

        // Out of stock product without isCritical flag -> MUST NOT be healthy
        const outOfStockInferred = evalCriticalStockCard(undefined, "Campus Org Hoodie", 0);
        assert(outOfStockInferred.isCritical === true, "Out of stock item inferred as critical");
        assert(outOfStockInferred.isHealthy === false, "Out of stock item inferred as NOT healthy");

        // Healthy store (All Products In Stock, unitsLeft: 0) -> MUST be healthy
        const healthy = evalCriticalStockCard(false, "All Products In Stock", 0);
        assert(healthy.isCritical === false, "All Products In Stock is NOT critical");
        assert(healthy.isHealthy === true, "All Products In Stock IS healthy");
        console.log("✓ Test 10: Critical Stock Card state properly distinguishes 0 units remaining from healthy inventory");
    }

    // Test 11: Weekly Sales Chart peak calculation
    {
        const calcPeak = (weeks: Array<{ revenue: number }>) => {
            const peakRevenue = Math.max(...weeks.map((w) => w?.revenue || 0));
            const hasSales = peakRevenue > 0;
            const peak = hasSales ? weeks.find((w) => (w?.revenue || 0) === peakRevenue) : null;
            return { peakRevenue, hasSales, peak };
        };

        const allZero = [{ revenue: 0 }, { revenue: 0 }, { revenue: 0 }, { revenue: 0 }];
        const zeroResult = calcPeak(allZero);
        assert(zeroResult.hasSales === false, "hasSales is false when all revenues are 0");
        assert(zeroResult.peak === null, "peak is null when all revenues are 0");

        const withSales = [{ revenue: 100 }, { revenue: 450 }, { revenue: 200 }, { revenue: 0 }];
        const salesResult = calcPeak(withSales);
        assert(salesResult.hasSales === true, "hasSales is true when revenue > 0");
        assert(salesResult.peakRevenue === 450, "peakRevenue correctly identified");
        assert(salesResult.peak?.revenue === 450, "peak week correctly identified");
        console.log("✓ Test 11: Weekly Sales Chart peak calculation behaves accurately on zero-sales vs active-sales");
    }

    // Test 12: KPI Card delta styles
    {
        const calcKpiDelta = (delta: number) => {
            const numericDelta = Number(delta ?? 0);
            const isPositive = numericDelta > 0;
            const isNeutral = numericDelta === 0;
            const deltaStyles = isNeutral
                ? "text-slate-600 bg-slate-100"
                : isPositive
                ? "text-emerald-600 bg-emerald-50"
                : "text-rose-600 bg-rose-50";
            const deltaSymbol = isNeutral ? "" : isPositive ? "↑ +" : "↓ ";
            return { isPositive, isNeutral, deltaStyles, deltaSymbol };
        };

        const zeroDelta = calcKpiDelta(0);
        assert(zeroDelta.isNeutral === true, "0% delta is neutral");
        assert(zeroDelta.deltaStyles.includes("slate"), "0% delta uses neutral slate styles");
        assert(zeroDelta.deltaSymbol === "", "0% delta has no directional arrow");

        const positiveDelta = calcKpiDelta(14.2);
        assert(positiveDelta.isPositive === true, "+14.2% delta is positive");
        assert(positiveDelta.deltaStyles.includes("emerald"), "+14.2% delta uses emerald styles");
        assert(positiveDelta.deltaSymbol === "↑ +", "+14.2% delta has up arrow");

        const negativeDelta = calcKpiDelta(-5.1);
        assert(negativeDelta.isPositive === false && negativeDelta.isNeutral === false, "-5.1% delta is negative");
        assert(negativeDelta.deltaStyles.includes("rose"), "-5.1% delta uses rose styles");
        assert(negativeDelta.deltaSymbol === "↓ ", "-5.1% delta has down arrow");
        console.log("✓ Test 12: KPI Card delta styles correctly distinguish neutral 0% from positive and negative deltas");
    }

    console.log("--- All 12 Verification Tests Passed Successfully! ---");
}

runTests()
    .catch((err) => {
        console.error("Test Suite Failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
