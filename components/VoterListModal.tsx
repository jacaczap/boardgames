import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Profile } from "@/lib/types";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import UserAvatar from "@/components/UserAvatar";

interface VoterListModalProps {
  visible: boolean;
  onClose: () => void;
  voted: Profile[];
  notVoted: Profile[];
  avatarUrls: Map<string, string>;
}

const VoterListModal: React.FC<VoterListModalProps> = ({
  visible,
  onClose,
  voted,
  notVoted,
  avatarUrls,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <VStack space="md">
            <HStack space="sm" className="items-center flex-wrap">
              <Ionicons name="checkmark" size={18} color="#16a34a" />
              {voted.map((p) => (
                <View key={p.id}>
                  <UserAvatar profile={p} avatarUrls={avatarUrls} size="sm" />
                </View>
              ))}
            </HStack>
            <HStack space="sm" className="items-center flex-wrap">
              <Ionicons name="close" size={18} color="#dc2626" />
              {notVoted.map((p) => (
                <View key={p.id}>
                  <UserAvatar profile={p} avatarUrls={avatarUrls} size="sm" />
                </View>
              ))}
            </HStack>
          </VStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
});

export default VoterListModal;
