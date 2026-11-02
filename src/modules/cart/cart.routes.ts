import { Router } from "express";
import { CartController } from "./cart.controller";

const router = Router();

// I-check mo kung anong tawag sa auth middleware ninyo (e.g., isAuthenticated, requireAuth)
// Para sa ngayon, iiwan ko muna siyang blanko para hindi mag-error, 
// pero dapat mo itong lagyan ng auth middleware bago i-merge.

router.get("/", CartController.getCart);
router.post("/items", CartController.addItem);
router.patch("/items/:cartItemId", CartController.updateQuantity);
router.delete("/items/:cartItemId", CartController.removeItem);
router.delete("/", CartController.clearCart);

export default router;