"""
conftest.py — 将 ai/ 根目录加入 sys.path，使测试可以直接 import services/core/api 等模块。
"""
import sys
import os

# 确保 ai/ 根目录在 sys.path 最前面
sys.path.insert(0, os.path.dirname(__file__))
