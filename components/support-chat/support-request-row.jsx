import { Image, Pressable, Text, View } from "react-native";

import { supportStyles } from "@/components/support-chat/styles";
import {
  formatRequestTime,
  getAvatarLabel,
  getRequestAgentProfile,
  getRequestLastActivityTime,
  getRequestStatusLabel,
  getRequestStatusTone,
  getRequestSummary,
  getUnreadSupportMessageCount,
} from "@/components/support-chat/support-chat-view-model";

export function SupportRequestRow({ request, customerId, onPress }) {
  const agentProfile = getRequestAgentProfile(request, customerId);
  const statusTone = getRequestStatusTone(request);
  const unreadCount = request?.active
    ? getUnreadSupportMessageCount(request, customerId)
    : 0;

  return (
    <Pressable style={supportStyles.requestRow} onPress={onPress}>
      <View style={supportStyles.requestMain}>
        {agentProfile.avatarUri ? (
          <Image
            source={{ uri: agentProfile.avatarUri }}
            style={supportStyles.avatarImage}
          />
        ) : (
          <View style={supportStyles.avatar}>
            <Text style={supportStyles.avatarText}>
              {getAvatarLabel(agentProfile.name)}
            </Text>
          </View>
        )}

        <View style={supportStyles.requestBody}>
          <View style={supportStyles.requestTextStack}>
            <Text style={supportStyles.requestNumber}>
              {request.requestNumber ||
                `#${String(request.id || "").padStart(6, "0")}`}
            </Text>
            <View style={supportStyles.requestTitleRow}>
              <Text style={supportStyles.requestTitle}>{agentProfile.name}</Text>
              <View style={supportStyles.requestDivider} />
              <View
                style={[
                  supportStyles.statusPill,
                  { backgroundColor: statusTone.bg },
                ]}
              >
                <Text
                  style={[
                    supportStyles.statusPillText,
                    { color: statusTone.text },
                  ]}
                >
                  {getRequestStatusLabel(request)}
                </Text>
              </View>
            </View>
            <Text numberOfLines={1} style={supportStyles.requestSummary}>
              {getRequestSummary(request, customerId, agentProfile.name)}
            </Text>
          </View>
        </View>
      </View>

      <View style={supportStyles.requestMeta}>
        {unreadCount > 0 ? (
          <View style={supportStyles.countBadge}>
            <Text style={supportStyles.countBadgeText}>{unreadCount}</Text>
          </View>
        ) : null}
        <Text style={supportStyles.requestTime}>
          {formatRequestTime(getRequestLastActivityTime(request))}
        </Text>
      </View>
    </Pressable>
  );
}
