import { useNavigate } from "react-router-dom";
import LocationSelection from "@/components/agrilink/LocationSelection";

const LocationPage = () => {
  const navigate = useNavigate();
  return (
    <LocationSelection onSelect={() => navigate("/")} />
  );
};

export default LocationPage;
