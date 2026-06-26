import { useLocalSearchParams } from "expo-router";

import { SupportChatDetailScreen } from "@/components/support-chat/support-chat-detail-screen";

export default function SupportChatDetailRoute() {
  const params = useLocalSearchParams();

  return (
    <SupportChatDetailScreen
      requestId={Array.isArray(params.id) ? params.id[0] : params.id}
      requestKind={
        Array.isArray(params.requestKind)
          ? params.requestKind[0]
          : params.requestKind
      }
      requestNumber={
        Array.isArray(params.requestNumber)
          ? params.requestNumber[0]
          : params.requestNumber
      }
      isDraft={
        (Array.isArray(params.isDraft) ? params.isDraft[0] : params.isDraft) ===
          "1" ||
        (Array.isArray(params.id) ? params.id[0] : params.id) === "new"
      }
    />
  );
}
