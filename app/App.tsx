import { StatusBar } from "expo-status-bar";
import DotBackground from "../src/components/dottedBackground";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useEffect, useState } from "react";
import { CardComponent } from "../src/components";

import { cardService } from "../src/services/cardService";
import type { Card } from "../src/types/card";
import type { SearchCardsParams } from "../src/services/cardService";
import { useThemeColors } from "../src/hooks/theme";
import { useDebounce } from "../src/hooks/debounce";

type CardFilters = Pick<
  SearchCardsParams,
  "colour" | "card_type" | "attribute" | "rarity" | "set_id" | "leadersOnly"
>;

const COLOUR_OPTIONS = ["Red", "Blue", "Green", "Purple", "Black", "Yellow"];
const CARD_TYPE_OPTIONS = ["Character", "Event", "Stage"];
const ATTRIBUTE_OPTIONS = ["Slash", "Strike", "Wisdom", "Ranged", "Special"];
const RARITY_OPTIONS = ["C", "UC", "R", "SR", "SEC", "L", "SP", "UTR"];
const SET_OPTIONS = ["OP01", "OP02", "OP03", "OP04", "OP05", "OP06"];
export default function App() {
  const theme = useThemeColors();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<CardFilters>({});
  const [initialLoad, setInitialLoad] = useState(true);
  // Fetch cards when component mounts
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const PAGE_SIZE = 30;

  const HandleSearch = async (
    query: string,
    pageNum: number = 0,
    append: boolean = false,
    activeFilters: CardFilters = {},
  ) => {
    console.log(
      "[HandleSearch] Query:",
      query,
      "Page:",
      pageNum,
      "Append:",
      append,
      "Filters:",
      activeFilters,
    );

    const offset = pageNum * PAGE_SIZE;
    let fetchedCards: Card[] = [];

    const searchParams: SearchCardsParams = {
      limit: PAGE_SIZE,
      offset,
      ...activeFilters,
    };

    if (query.trim() !== "") {
      searchParams.searchTerm = query;
    }

    console.log("[HandleSearch] Fetching cards with params:", searchParams);
    const result = await cardService.SearchCards(searchParams);
    fetchedCards = result.data;

    const filteredResults = fetchedCards.filter((card) => card != null);

    // Check if we have more data to load
    setHasMore(filteredResults.length === PAGE_SIZE);

    console.log(
      "[HandleSearch] Got",
      filteredResults.length,
      "results, hasMore:",
      filteredResults.length === PAGE_SIZE,
    );

    if (!append && filteredResults.length === 0 && pageNum === 0) {
      Alert.alert("No Results", "No cards found matching your search.");
    }

    return filteredResults;
  };

  useEffect(() => {
    const initialLoadCards = async () => {
      try {
        const fetchedCards = await HandleSearch("", 0, false);
        setCards(fetchedCards);
        setPage(0);
      } catch (error) {
        Alert.alert("Error", "Failed to fetch cards. Please try again.");
      } finally {
        setInitializing(false);
        setInitialLoad(false);
      }
    };
    initialLoadCards();
  }, []);

  useEffect(() => {
    if (initialLoad) {
      return; // Skip debounce on initial load
    }

    const Searchhandler = async () => {
      console.log("[Searchhandler] Starting search for:", debouncedSearchTerm);
      setLoading(true);
      setPage(0); // Reset to first page on new search
      try {
        const results = await HandleSearch(debouncedSearchTerm, 0, false, filters);
        setCards(results);
      } finally {
        setLoading(false);
      }
    };
    Searchhandler();
  }, [debouncedSearchTerm, filters, initialLoad]);

  const loadMoreCards = async () => {
    if (loadingMore || !hasMore) {
      console.log(
        "[loadMoreCards] Skipping - loadingMore:",
        loadingMore,
        "hasMore:",
        hasMore,
      );
      return;
    }

    console.log("[loadMoreCards] Loading page:", page + 1);
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const moreCards = await HandleSearch(debouncedSearchTerm, nextPage, true, filters);
      setCards((prevCards) => [...prevCards, ...moreCards]);
      setPage(nextPage);
    } catch (error) {
      console.error("[loadMoreCards] Error:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={{ color: theme.textSecondary, marginLeft: 10 }}>
          Loading more...
        </Text>
      </View>
    );
  };

  // This function runs when you press the button
  const handleTestPress = () => {
    Alert.alert("It works!", "You are ready to build the Card Finder.");
  };

  const toggleStringFilter = (
    key: Exclude<keyof CardFilters, "leadersOnly">,
    value: string,
  ) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (next[key] === value) {
        delete next[key];
      } else {
        next[key] = value;
        if (key === "card_type") {
          delete next.leadersOnly;
        }
      }
      return next;
    });
  };

  const toggleLeadersOnly = () => {
    setFilters((prev) => {
      if (prev.leadersOnly) {
        const next = { ...prev };
        delete next.leadersOnly;
        return next;
      }
      const next = { ...prev, leadersOnly: true };
      delete next.card_type;
      return next;
    });
  };

  const clearFilters = () => setFilters({});

  const hasActiveFilters = Object.keys(filters).length > 0;

  const renderFilterChip = (
    label: string,
    selected: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? theme.accent : theme.card,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          { color: selected ? "#fff" : theme.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderFilterRow = (
    title: string,
    options: string[],
    selected: string | undefined,
    onSelect: (value: string) => void,
  ) => (
    <View style={styles.filterRow}>
      <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChipRow}
      >
        {options.map((option) =>
          renderFilterChip(option, selected === option, () => onSelect(option)),
        )}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.root}>
      <DotBackground />
      <View style={styles.container}>
        {/* 1. The Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            🏴‍☠️ One Piece Card Finder
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Find your favorite cards easily!
          </Text>
        </View>

        {/* 2. A Mock Search Bar */}
        <View style={styles.searchBox}>
          <TextInput
            placeholder="Search for cards (e.g., OP05-060)..."
            placeholderTextColor="#666"
            value={searchTerm}
            onChangeText={(text) => {
              console.log("[TextInput] User typed:", text);
              setSearchTerm(text);
            }}
            style={styles.input}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchTerm("")}
              style={{ position: "absolute", right: 10, top: 10 }}
            >
              <Text style={{ color: "#666", fontSize: 16 }}>X</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filtersContainer}>
          {renderFilterRow("Colour", COLOUR_OPTIONS, filters.colour, (value) =>
            toggleStringFilter("colour", value),
          )}
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>
              Type
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipRow}
            >
              {renderFilterChip("Leaders", !!filters.leadersOnly, toggleLeadersOnly)}
              {CARD_TYPE_OPTIONS.map((option) =>
                renderFilterChip(
                  option,
                  filters.card_type === option,
                  () => toggleStringFilter("card_type", option),
                ),
              )}
            </ScrollView>
          </View>
          {renderFilterRow(
            "Attribute",
            ATTRIBUTE_OPTIONS,
            filters.attribute,
            (value) => toggleStringFilter("attribute", value),
          )}
          {renderFilterRow("Rarity", RARITY_OPTIONS, filters.rarity, (value) =>
            toggleStringFilter("rarity", value),
          )}
          {renderFilterRow("Set", SET_OPTIONS, filters.set_id, (value) =>
            toggleStringFilter("set_id", value),
          )}
          {hasActiveFilters && (
            <TouchableOpacity onPress={clearFilters} style={styles.clearFilters}>
              <Text style={{ color: theme.accent, fontSize: 14 }}>
                Clear filters
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Grid Layout for Cards */}
        {initializing ? (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={{ color: theme.text, marginTop: 10 }}>
              Loading cards...
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, position: "relative" }}>
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            )}
            <FlatList
              data={cards}
              keyExtractor={(card: Card) => card.card_id}
              renderItem={({ item }: { item: Card }) => (
                <CardComponent card={item} />
              )}
              numColumns={2}
              contentContainerStyle={styles.cardsContainer}
              columnWrapperStyle={styles.cardGrid}
              showsVerticalScrollIndicator={false}
              onEndReached={loadMoreCards}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderFooter}
            />
          </View>
        )}
        {/* <ScrollView contentContainerStyle={styles.cardsContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" />
        ) : (
          <View style={styles.cardGrid}>
            {cards.map((card) => (
              <CardComponent  card={card} />
            ))}
          </View>
        )}
      </ScrollView> */}

        {/* 3. A Test Button */}
        <TouchableOpacity style={styles.button} onPress={handleTestPress}>
          <Text style={styles.buttonText}>Test Connection</Text>
        </TouchableOpacity>

        <StatusBar style="auto" />
      </View>
    </View>
  );
}

// 4. The Styles (CSS-in-JS)
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  header: {
    marginTop: 50,
    marginBottom: 20,
    alignItems: "center",
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 0,
  },
  searchBox: {
    width: "100%",
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    backgroundColor: "#f9f9f9",
  },
  input: {
    fontSize: 16,
  },
  filtersContainer: {
    width: "100%",
    marginBottom: 12,
    gap: 8,
  },
  filterRow: {
    gap: 4,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterChipRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  clearFilters: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  button: {
    backgroundColor: "#007AFF", // Blue color
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  cardsContainer: {
    flexGrow: 1,
    width: "100%",
    paddingVertical: 10,
    gap: 16,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    gap: 16,
  },
  loadingOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 1000,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  footerLoader: {
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});
