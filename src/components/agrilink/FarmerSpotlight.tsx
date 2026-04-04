import { motion } from "framer-motion";
import { MapPin, ArrowRight } from "lucide-react";
import farmerImg from "@/assets/farmer-spotlight.jpg";

const FarmerSpotlight = () => {
  return (
    <div className="py-5 max-w-lg mx-auto px-4">
      <h2 className="text-base font-bold text-foreground mb-3">Farmer Spotlight</h2>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="bg-card border border-border rounded-2xl overflow-hidden shadow-agri-lg"
      >
        <div className="flex gap-4 p-4">
          <img
            src={farmerImg}
            alt="Farmer Ramesh Patel"
            className="w-20 h-20 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-foreground">Ramesh Patel</h3>
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground">Organic Farm, Nashik</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
              Growing organic vegetables for 15+ years. Specializes in heirloom tomatoes and leafy greens.
            </p>
            <button className="flex items-center gap-1 mt-3 text-xs font-bold text-primary">
              View Farm Story <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default FarmerSpotlight;
