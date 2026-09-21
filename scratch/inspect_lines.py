import sys

with open("src/App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

print("\n--- Line 2585 to 2595 ---")
for i in range(2584, 2595):
    print(f"{i+1}: {repr(lines[i])}")

print("\n--- Line 3842 to 3850 ---")
for i in range(3841, 3850):
    print(f"{i+1}: {repr(lines[i])}")

print("\n--- Line 6065 to 6075 ---")
for i in range(6064, 6075):
    print(f"{i+1}: {repr(lines[i])}")

print("\n--- Line 6455 to 6465 ---")
for i in range(6454, 6465):
    print(f"{i+1}: {repr(lines[i])}")

print("\n--- Line 7923 to 7938 ---")
for i in range(7922, 7938):
    print(f"{i+1}: {repr(lines[i])}")

print("\n--- Line 8190 to 8200 ---")
for i in range(8189, 8200):
    print(f"{i+1}: {repr(lines[i])}")
