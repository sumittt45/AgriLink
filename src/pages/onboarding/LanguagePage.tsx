import { useNavigate } from "react-router-dom";
import LanguageSelection from "@/components/agrilink/LanguageSelection";

const LanguagePage = () => {
  const navigate = useNavigate();
  return (
    <LanguageSelection onSelect={() => navigate("/onboarding/location")} />
  );
};

export default LanguagePage;
