import express from "express";
import http from "http";
import { Server } from "socket.io";
import ConnectDB from "./config/connectDB.js";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cookie from "cookie";
import User from "./models/User.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();
const app = express();
ConnectDB();
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
});

let waitingQueue = [];
const activeRooms = {};

io.on("connection", async (socket) => {
  try {
    const cookies = cookie.parse(socket.handshake.headers.cookie || "");
    const token = cookies.token;
    if (!token) {
      throw new Error("Authentication failed: No token");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      throw new Error("Authentication failed: User not found");
    }

    socket.user = user;
    console.log(`User connected: ${user.fullName} (${socket.id})`);
    io.emit("update-online-count", io.sockets.sockets.size);
  } catch (error) {
    console.error("Socket connection error:", error.message);
    socket.disconnect(true);
    return;
  }

  socket.on("report-user", async ({ roomId }) => {
    if (!roomId || !activeRooms[roomId] || !socket.user || !socket.user._id) {
      return socket.emit("action-failed", {
        message: "Invalid request to report.",
      });
    }

    const room = activeRooms[roomId];
    const partnerSocketId = room.users.find((id) => id !== socket.id);
    const partnerSocket = io.sockets.sockets.get(partnerSocketId);

    if (!partnerSocket || !partnerSocket.user || !partnerSocket.user._id) {
      return socket.emit("action-failed", {
        message: "Cannot find the user to report.",
      });
    }

    try {
      const reporterId = socket.user._id;
      const reportedUserId = partnerSocket.user._id;
      if (reporterId.equals(reportedUserId)) {
        return socket.emit("action-failed", {
          message: "You cannot report yourself.",
        });
      }

      const reportedUser = await User.findById(reportedUserId);
      if (!reportedUser) {
        return socket.emit("action-failed", {
          message: "Reported user not found in database.",
        });
      }

      const alreadyReported = reportedUser.reports.some((report) =>
        report.reporter.equals(reporterId),
      );

      if (!alreadyReported) {
        reportedUser.reports.push({ reporter: reporterId });
        await reportedUser.save(); // This will trigger the pre-save hook for suspension check
        socket.emit("action-success", { message: "User reported. Thank you!" });
        console.log(
          `User ${socket.user.fullName} reported ${reportedUser.fullName}`,
        );
        if (reportedUser.isSuspended) {
          console.log(
            `User ${reportedUser.fullName} was suspended by report from ${socket.user.fullName}`,
          );
          partnerSocket.emit("account-suspended", {
            reason: "Your account is suspended due to multiple reports.",
          });
          partnerSocket.disconnect(true); // Force disconnect
        }
      } else {
        socket.emit("action-info", {
          message: "You have already reported this user.",
        });
      }
    } catch (error) {
      console.error("Error reporting user:", error);
      socket.emit("action-failed", {
        message: "Server error while reporting user.",
      });
    }
  });
  socket.on("block-user", async ({ roomId }) => {
    if (!roomId || !activeRooms[roomId] || !socket.user || !socket.user._id) {
      return socket.emit("action-failed", {
        message: "Invalid request to block.",
      });
    }

    const room = activeRooms[roomId];
    const partnerSocketId = room.users.find((id) => id !== socket.id);
    const partnerSocket = io.sockets.sockets.get(partnerSocketId);

    if (!partnerSocket || !partnerSocket.user || !partnerSocket.user._id) {
      return socket.emit("action-failed", {
        message: "Cannot find the user to block.",
      });
    }

    try {
      const blockerId = socket.user._id;
      const blockedUserId = partnerSocket.user._id;

      // Prevent self-blocking
      if (blockerId.equals(blockedUserId)) {
        return socket.emit("action-failed", {
          message: "You cannot block yourself.",
        });
      }

      const currentUser = await User.findById(blockerId);
      if (!currentUser) {
        return socket.emit("action-failed", {
          message: "Could not find your user data.",
        });
      }

      // Check if already blocked
      const alreadyBlocked = currentUser.blockedUsers.some((id) =>
        id.equals(blockedUserId),
      );

      if (!alreadyBlocked) {
        currentUser.blockedUsers.push(blockedUserId);
        await currentUser.save();

        // IMPORTANT: Update the live socket.user object immediately
        socket.user.blockedUsers = currentUser.blockedUsers;

        socket.emit("action-success", {
          message: "User blocked. Chat ended. Finding new chat...",
        });
        console.log(
          `User ${currentUser.fullName} blocked ${partnerSocket.user.fullName}`,
        );

        // End the current chat immediately after blocking
        io.to(roomId).emit("chat-ended", {
          reason: "Chat ended by other user.",
        }); // Notify partner
        // Clean up room
        room.users.forEach((userId) => {
          const userSocket = io.sockets.sockets.get(userId);
          if (userSocket) userSocket.leave(roomId);
        });
        delete activeRooms[roomId];
        socket.emit("find-new-chat");
      } else {
        socket.emit("action-info", { message: "User is already blocked." });
      }
    } catch (error) {
      console.error("Error blocking user:", error);
      socket.emit("action-failed", {
        message: "Server error while blocking user.",
      });
    }
  });

  socket.on("start-guftagu", async (preferences) => {
    if (socket.user?.isSuspended) {
      console.log(`Suspended user ${socket.user.fullName} attempted to match.`);
      return socket.emit("match-failed", {
        message: "Your account is currently suspended.",
      });
    }

    let currentUser;
    try {
      currentUser = await User.findById(socket.user._id).select(
        "blockedUsers isSuspended sex year fullName",
      );
      if (!currentUser)
        throw new Error("Current user not found during refresh");
      socket.user = { ...socket.user, ...currentUser.toObject() };
    } catch (err) {
      console.error(
        `Failed to refresh user data for matching (${socket.user?.fullName}):`,
        err,
      );
      return socket.emit("match-failed", {
        message: "Error verifying your account status.",
      });
    }
    if (currentUser.isSuspended) {
      console.log(
        `Suspended user ${currentUser.fullName} detected after refresh.`,
      );
      return socket.emit("match-failed", {
        message: "Your account is currently suspended.",
      });
    }

    const matchIndex = waitingQueue.findIndex((peer) => {
      const peerUser = peer.user; // User object of the person waiting in queue

      if (!peerUser || !peerUser._id || peer.socket.id === socket.id)
        return false;
      if (peerUser.isSuspended) return false;
      const iBlockedPeer = currentUser.blockedUsers?.some((blockedId) =>
        blockedId.equals(peerUser._id),
      );
      const peerBlockedMe = peerUser.blockedUsers?.some((blockedId) =>
        blockedId.equals(currentUser._id),
      );
      if (iBlockedPeer || peerBlockedMe) {
        return false;
      }

      const currentUserLikesPeerGender =
        preferences.gender === "Any" || preferences.gender === peerUser.sex;
      const peerLikesCurrentUserGender =
        peer.preferences.gender === "Any" ||
        peer.preferences.gender === currentUser.sex;
      if (!currentUserLikesPeerGender || !peerLikesCurrentUserGender)
        return false; // Gender doesn't match mutually

      const yearMatch =
        preferences.year === "Random" ||
        peer.preferences.year === "Random" ||
        preferences.year === peer.preferences.year;
      if (!yearMatch) return false; // Year preference doesn't match

      return true;
    });

    if (matchIndex !== -1) {
      const match = waitingQueue.splice(matchIndex, 1)[0]; // Get the matched peer and remove them

      // Create and join room
      const roomId = `room-${socket.id}-${match.socket.id}`;
      socket.join(roomId);
      match.socket.join(roomId);

      activeRooms[roomId] = {
        users: [socket.id, match.socket.id],
        revealRequests: {},
      };

      // Notify both users
      io.to(roomId).emit("chat-started", { roomId });
      console.log(
        `Chat started: ${roomId} between ${currentUser.fullName} and ${match.user.fullName}`,
      );
    } else {
      // No match found - Add user to queue (if not already there)
      const alreadyWaiting = waitingQueue.some(
        (peer) => peer.socket.id === socket.id,
      );
      if (!alreadyWaiting) {
        // Pass the refreshed currentUser data to the queue item
        waitingQueue.push({
          socket,
          preferences,
          user: currentUser.toObject(),
        });
        socket.emit("waiting-for-peer");
        console.log(
          `User added to queue: ${currentUser.fullName} (${socket.id})`,
        );
      } else {
        // Already waiting, just confirm
        socket.emit("waiting-for-peer");
        // console.log(`User already waiting: ${currentUser.fullName} (${socket.id})`); // Optional log
      }
    }
  });
  socket.on("stop-matching", () => {
    waitingQueue = waitingQueue.filter((peer) => peer.socket.id !== socket.id);
    console.log("User removed from queue:", socket.id);
    socket.emit("stopped-waiting");
  });

  socket.on("send-message", ({ roomId, message }) => {
    socket.to(roomId).emit("new-message", { message: message });
  });

  socket.on("typing", ({ roomId, isTyping }) => {
    socket.to(roomId).emit("typing-status", { isTyping });
  });

  socket.on("request-reveal", ({ roomId }) => {
    const room = activeRooms[roomId];
    if (!room) return;

    room.revealRequests[socket.id] = true;

    const otherUserId = room.users.find((id) => id !== socket.id);
    const otherUserSocket = io.sockets.sockets.get(otherUserId);
    const currentUserSocket = io.sockets.sockets.get(socket.id);

    if (room.revealRequests[otherUserId]) {
      io.to(roomId).emit("identity-revealed", {
        [socket.id]: {
          fullName: currentUserSocket.user.fullName,
          profilePicture: currentUserSocket.user._doc.profilePicture || "",
        },
        [otherUserId]: {
          fullName: otherUserSocket.user.fullName,
          profilePicture: otherUserSocket.user._doc.profilePicture || "",
        },
      });
    } else {
      socket.to(roomId).emit("reveal-requested");
    }
  });

  socket.on("next-chat", ({ roomId }) => {
    if (roomId && activeRooms[roomId]) {
      io.to(roomId).emit("chat-ended");
      const room = activeRooms[roomId];
      room.users.forEach((userId) => {
        const userSocket = io.sockets.sockets.get(userId);
        if (userSocket) userSocket.leave(roomId);
      });
      delete activeRooms[roomId];
    }
    socket.emit("find-new-chat");
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    io.emit("update-online-count", io.sockets.sockets.size);
    waitingQueue = waitingQueue.filter((peer) => peer.socket.id !== socket.id);
    for (const roomId in activeRooms) {
      const room = activeRooms[roomId];
      if (room.users.includes(socket.id)) {
        io.to(roomId).emit("chat-ended");
        delete activeRooms[roomId];
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
