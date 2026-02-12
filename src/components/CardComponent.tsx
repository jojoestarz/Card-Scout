import { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Card } from "../types/card";

type CardComponentProps = {
  card: Card;
};

export const CardComponent = ({ card }: CardComponentProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const imageSource = useMemo(() => {
    if (card.image_url) {
      return { uri: card.image_url };
    }
    return null;
  }, [card.image_url]);

  return (
    <>
      <TouchableOpacity
        style={styles.cardContainer}
        activeOpacity={0.85}
        onPress={() => setIsOpen(true)}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.cardTitle}>{card.name}</Text>
              <Text style={styles.cardMeta}>{card.card_id}</Text>

              {imageSource ? (
                <Image
                  source={imageSource}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              ) : null}

              <View style={styles.infoRow}>
                <Text style={styles.label}>Colour</Text>
                <Text style={styles.value}>{card.colour}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Rarity</Text>
                <Text style={styles.value}>{card.rarity}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Type</Text>
                <Text style={styles.value}>{card.card_type}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Cost</Text>
                <Text style={styles.value}>{card.cost ?? "-"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Power</Text>
                <Text style={styles.value}>{card.power ?? "-"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Life</Text>
                <Text style={styles.value}>{card.life ?? "-"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Counter</Text>
                <Text style={styles.value}>{card.counter ?? "-"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Set</Text>
                <Text style={styles.value}>{card.set_id}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Attribute</Text>
                <Text style={styles.value}>{card.attribute}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Subtype</Text>
                <Text style={styles.value}>{card.sub_type ?? "-"}</Text>
              </View>

              <Text style={styles.effectLabel}>Effect</Text>
              <Text style={styles.effectText}>
                {card.effect || "No effect text."}
              </Text>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsOpen(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: 160,
    height: 240,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#111",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
  },
  placeholderText: {
    color: "#bbb",
    fontSize: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "90%",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
  },
  modalContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1b1b1b",
  },
  cardMeta: {
    fontSize: 12,
    color: "#666",
    marginBottom: 12,
  },
  modalImage: {
    width: "100%",
    height: 220,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    color: "#666",
  },
  value: {
    fontSize: 12,
    color: "#1b1b1b",
    fontWeight: "600",
  },
  effectLabel: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "700",
    color: "#1b1b1b",
  },
  effectText: {
    fontSize: 12,
    color: "#444",
    marginTop: 4,
  },
  closeButton: {
    marginTop: 16,
    backgroundColor: "#111",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
