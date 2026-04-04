import StickyHeader from "@/components/agrilink/StickyHeader";
import SearchBar from "@/components/agrilink/SearchBar";
import HeroBanner from "@/components/agrilink/HeroBanner";
import BuyerFarmerHero from "@/components/agrilink/BuyerFarmerHero";
import QuickCategories from "@/components/agrilink/QuickCategories";
import TrendingProducts from "@/components/agrilink/TrendingProducts";
import SmartFeatures from "@/components/agrilink/SmartFeatures";
import LocalFarmerPicks from "@/components/agrilink/LocalFarmerPicks";
import FreshDealsBanner from "@/components/agrilink/FreshDealsBanner";
import BottomNav from "@/components/agrilink/BottomNav";

const Index = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <StickyHeader />
      <SearchBar />
      <HeroBanner />
      <BuyerFarmerHero />
      <QuickCategories />
      <FreshDealsBanner />
      <TrendingProducts />
      <SmartFeatures />
      <LocalFarmerPicks />
      <BottomNav />
    </div>
  );
};

export default Index;
