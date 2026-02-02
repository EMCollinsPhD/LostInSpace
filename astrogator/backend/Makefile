# Makefile for Astrogator Backend

CXX ?= g++
override CXXFLAGS += -std=c++17 -O2 -Iinclude -Wall -Wextra
LDFLAGS += -pthread -ldl

# CSPICE Configuration
# Adjust CSPICE_PATH to where you unzipped the toolkit
# structure: $(CSPICE_PATH)/include and $(CSPICE_PATH)/lib/libcspice.a
CSPICE_PATH ?= ../lib/cspice
CSPICE_LIB := $(CSPICE_PATH)/lib/cspice.a
CSPICE_INC := $(CSPICE_PATH)/include

# Check if CSPICE exists, if not warn
ifneq ("$(wildcard $(CSPICE_LIB))","")
    $(info Found CSPICE at $(CSPICE_LIB))
    override CXXFLAGS += -I$(CSPICE_INC)
    LIBS += $(CSPICE_LIB)
else
    $(warning CSPICE library not found at $(CSPICE_LIB). Build may fail.)
endif

TARGET = astrogator_backend
SRC_DIR = src
OBJ_DIR = obj

SRCS = $(wildcard $(SRC_DIR)/*.cpp)
OBJS = $(patsubst $(SRC_DIR)/%.cpp, $(OBJ_DIR)/%.o, $(SRCS))

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) -o $@ $^ $(LIBS) $(LDFLAGS)

$(OBJ_DIR)/%.o: $(SRC_DIR)/%.cpp | $(OBJ_DIR)
	$(CXX) $(CXXFLAGS) -c -o $@ $<

$(OBJ_DIR):
	mkdir -p $(OBJ_DIR)

clean:
	rm -rf $(OBJ_DIR) $(TARGET)

.PHONY: all clean
