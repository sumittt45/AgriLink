import { useState, useRef, useEffect } from "react";
import { Search, Mic, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const searchData = [
  { name: "Fresh Tomatoes", type: "crop", emoji: "🍅" },
  { name: "Organic Spinach", type: "crop", emoji: "🥬" },
  { name: "Farm Potatoes", type: "crop", emoji: "🥔" },
  { name: "Sweet Mangoes", type: "crop", emoji: "🥭" },
  { name: "Green Capsicum", type: "crop", emoji: "🫑" },
  { name: "Fresh Carrots", type: "crop", emoji: "🥕" },
  { name: "Red Onions", type: "crop", emoji: "🧅" },
  { name: "Baby Corn", type: "crop", emoji: "🌽" },
  { name: "Broccoli", type: "crop", emoji: "🥦" },
  { name: "Cauliflower", type: "crop", emoji: "🥬" },
  { name: "Basmati Rice", type: "crop", emoji: "🌾" },
  { name: "Ravi Kumar Farm", type: "farmer", emoji: "👨‍🌾" },
  { name: "Lakshmi Devi Farm", type: "farmer", emoji: "👩‍🌾" },
  { name: "Suresh Yadav Farm", type: "farmer", emoji: "👨‍🌾" },
  { name: "Vegetables", type: "category", emoji: "🥦" },
  { name: "Fruits", type: "category", emoji: "🍎" },
  { name: "Grains & Pulses", type: "category", emoji: "🌾" },
  { name: "Organic Products", type: "category", emoji: "🌿" },
];

const SearchBar = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = query.length > 0
    ? searchData.filter(d => d.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  const showResults = focused && results.length > 0;

  const handleSelect = (item: typeof searchData[0]) => {
    setQuery("");
    setFocused(false);
    if (item.type === "crop") {
      navigate(`/available-farmers?crop=${encodeURIComponent(item.name)}`);
    } else if (item.type === "farmer") {
      navigate("/farmers");
    } else {
      navigate("/category");
    }
  };

  useEffect(() => {
    if (!focused) return;
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.parentElement?.parentElement?.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [focused]);

  return (
    <div className="px-4 py-3 max-w-lg mx-auto relative">
      <div className="relative" ref={inputRef}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search fresh vegetables, fruits, grains…"
          className="w-full pl-12 pr-12 py-3.5 bg-muted rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
        />
        {query ? (
          <button onClick={() => { setQuery(""); inputRef.current?.querySelector("input")?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        ) : (
          <button className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <Mic className="w-4 h-4 text-primary" />
          </button>
        )}
      </div>

      {showResults && (
        <div className="absolute left-4 right-4 top-full mt-1 bg-card border border-border rounded-2xl shadow-agri-lg z-50 overflow-hidden">
          {results.map(item => (
            <button
              key={item.name}
              onClick={() => handleSelect(item)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left border-b border-border last:border-0"
            >
              <span className="text-lg">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{item.type}</p>
              </div>
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
